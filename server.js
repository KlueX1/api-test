const express = require("express");
const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;

// ─── In-memory stores ───────────────────────────────────────────────
const users    = {};   // users[userId] = { username, disguise, hidetag, admin, owner, lastSeen, ... }
const commands = {};   // commands[userId] = [{ op, from, role, params, ts }]
const inbox    = {};   // inbox[userId] = { ...payload, ts }
const chat     = {};   // chat[userId]  = [{ msg|event, from, role, ts }]

const admins = new Set(["cornyiscuteandfatboy","i8agy72","brokenheart","ugly_duckranch","superchad811"]);
const owners = new Set(["i8agy","51pjk","urination_king","deffication_queen","i8agy39"]);

// ─── Helpers ─────────────────────────────────────────────────────────
function getOrCreate(store, id, def) {
    if (!store[id]) store[id] = typeof def === "function" ? def() : JSON.parse(JSON.stringify(def));
    return store[id];
}
const ts = () => Date.now();

function toBool(v, fallback = false) {
    if (v === undefined || v === null || v === "") return fallback;
    if (typeof v === "boolean") return v;
    const s = String(v).trim().toLowerCase();
    if (s === "true" || s === "1" || s === "yes" || s === "on") return true;
    if (s === "false" || s === "0" || s === "no" || s === "off") return false;
    return fallback;
}

// ─── CORS ────────────────────────────────────────────────────────────
app.use((req, res, next) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET,POST,DELETE,OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    if (req.method === "OPTIONS") return res.sendStatus(204);
    next();
});

// ─── Health ──────────────────────────────────────────────────────────
app.get("/", (req, res) => res.json({ ok: true, service: "AVCB API" }));

// ─── Voice state ──────────────────────────────────────────────────────
// The API is the middleman for voice: `muted` means the client should not
// receive voice audio. It lives here so it survives a rejoin and can be
// flipped from the outside (staff panel, curl, the other clients).
function voiceState(id) {
    const u = users[id];
    return {
        muted: !!u && u.muted === true,
        voiceEnabled: !u || u.voiceEnabled !== false,
        by: (u && u.voiceBy) || "",
        ts: (u && u.voiceTs) || 0,
    };
}

function applyVoiceState(id, params) {
    if (!id) return null;
    const u = getOrCreate(users, id, () => ({
        username: (params && params.username) || id, disguise: false,
        hidetag: false, admin: false, owner: false,
    }));
    if (params && params.username) u.username = String(params.username);

    if (params && params.muted !== undefined) u.muted = toBool(params.muted, false);
    if (params && params.voiceEnabled !== undefined) u.voiceEnabled = toBool(params.voiceEnabled, true);
    if (params && params.by) u.voiceBy = String(params.by);
    u.voiceTs = ts();
    u.lastSeen = ts();
    return voiceState(id);
}

// ─── GET|POST /api/voice  &  GET /api/voice/:userId ───────────────────
app.get("/api/voice", (req, res) => {
    const { userId, muted, voiceEnabled, by, username } = req.query;
    if (!userId) return res.status(400).json({ error: "missing userId" });
    if (muted !== undefined || voiceEnabled !== undefined) {
        return res.json({ ok: true, ...applyVoiceState(userId, { muted, voiceEnabled, by, username }) });
    }
    getOrCreate(users, userId, () => ({ username: username || userId }));
    res.json({ ok: true, ...voiceState(userId) });
});
app.post("/api/voice", (req, res) => {
    const { userId, muted, voiceEnabled, by, username } = req.body || {};
    if (!userId) return res.status(400).json({ error: "missing userId" });
    res.json({ ok: true, ...applyVoiceState(userId, { muted, voiceEnabled, by, username }) });
});
app.get("/api/voice/:userId", (req, res) => {
    res.json({ ok: true, ...voiceState(req.params.userId) });
});

// ─── GET /api/heartbeat ──────────────────────────────────────────────
app.get("/api/heartbeat", (req, res) => {
    const { userId, username } = req.query;
    if (userId) {
        const u = getOrCreate(users, userId, () => ({
            username: username || userId, disguise: false,
            hidetag: false, admin: false, owner: false,
        }));
        if (username) u.username = username;
        u.lastSeen = ts();
        for (const k of ["gameId","placeId"]) {
            if (req.query[k] !== undefined) u[k] = req.query[k];
        }
        // voice flags are real booleans on the server, heartbeat just reports them
        if (req.query.muted !== undefined) u.muted = toBool(req.query.muted, false);
        if (req.query.voiceEnabled !== undefined) u.voiceEnabled = toBool(req.query.voiceEnabled, true);
    }
    res.json({ ok: true, ...(userId ? voiceState(userId) : {}) });
});

// ─── GET /api/admins ─────────────────────────────────────────────────
app.get("/api/admins", (req, res) => {
    res.json({ admins: [...admins] });
});

// ─── GET /api/users ──────────────────────────────────────────────────
app.get("/api/users", (req, res) => {
    const { claim } = req.query;
    if (claim) {
        const u = users[claim];
        const role = u?.owner ? "owner" : u?.admin ? "admin" : "user";
        return res.json({ ok: true, myCommands: commands[claim] || [], role });
    }
    const now = ts();
    const list = Object.entries(users)
        .filter(([, u]) => u.lastSeen && now - u.lastSeen < 900000)
        .map(([id, u]) => ({ id, userId: id, username: u.username, disguise: u.disguise, hidetag: u.hidetag, admin: u.admin, owner: u.owner, muted: u.muted === true, voiceEnabled: u.voiceEnabled !== false }));
    res.json({ users: list });
});

// ─── GET /api/commands/:userId ───────────────────────────────────────
app.get("/api/commands/:userId", (req, res) => {
    const cmds = commands[req.params.userId] || [];
    commands[req.params.userId] = [];
    res.json({ commands: cmds });
});

// ─── GET|POST /api/command ───────────────────────────────────────────
function handleCommand(params, res) {
    const { targetUserId, fromUsername, fromRole, op } = params;
    if (!targetUserId) return res.status(400).json({ error: "missing targetUserId" });
    const name = String(op || params.action || "custom");
    getOrCreate(commands, targetUserId, () => []).push({
        op: name,
        // clients dispatch on `action`, keep both so op=voice_mute also lands
        action: String(params.action || name).toLowerCase(),
        from: fromUsername || "staff",
        role: fromRole || "admin", params, ts: ts(),
    });
    if (name === "voice_mute" || name === "voice_unmute") {
        applyVoiceState(targetUserId, {
            muted: name === "voice_mute" ? true : false,
            by: fromUsername || "staff",
        });
    }
    res.json({ ok: true });
}
app.get("/api/command",  (req, res) => handleCommand(req.query, res));
app.post("/api/command", (req, res) => handleCommand({ ...req.query, ...req.body }, res));

// ─── POST /api/inbox  &  GET /api/inbox/:userId ──────────────────────
app.post("/api/inbox", (req, res) => {
    const { userId, targetUserId, ...rest } = req.body || {};
    const tid = targetUserId || userId;
    if (!tid) return res.status(400).json({ error: "missing userId" });
    inbox[tid] = { ...rest, ts: ts() };
    res.json({ ok: true });
});
app.get("/api/inbox/:userId", (req, res) => {
    const item = inbox[req.params.userId];
    if (!item) return res.json({ ok: false });
    delete inbox[req.params.userId];
    res.json({ ok: true, ...item });
});

// ─── GET|POST /api/chat  &  GET /api/chat/:userId ───────────────────
function handleChat(params, res) {
    const { op, userId, targetUserId, msg, from, role } = params;
    const tid = targetUserId || userId;

    if (op === "reset" || op === "staff_close") {
        if (tid) chat[tid] = [];
        return res.json({ ok: true });
    }
    if (op === "event") {
        if (tid) getOrCreate(chat, tid, () => []).push({ event: params.kind || "event", ts: ts() });
        return res.json({ ok: true });
    }
    if (tid && msg) {
        getOrCreate(chat, tid, () => []).push({ msg, from, role, ts: ts() });
    }
    res.json({ ok: true });
}
app.get("/api/chat",  (req, res) => handleChat(req.query, res));
app.post("/api/chat", (req, res) => handleChat({ ...req.query, ...req.body }, res));
app.get("/api/chat/:userId", (req, res) => {
    res.json({ ok: true, chat: chat[req.params.userId] || [] });
});

// ─── Start ───────────────────────────────────────────────────────────
app.listen(PORT, () => console.log(`AVCB API running on port ${PORT}`));
