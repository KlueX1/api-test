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
        for (const k of ["gameId","placeId","muted","voiceEnabled"]) {
            if (req.query[k] !== undefined) u[k] = req.query[k];
        }
    }
    res.json({ ok: true });
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
        .filter(([, u]) => u.lastSeen && now - u.lastSeen < 300000)
        .map(([id, u]) => ({ id, username: u.username, disguise: u.disguise, hidetag: u.hidetag, admin: u.admin, owner: u.owner }));
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
    getOrCreate(commands, targetUserId, () => []).push({
        op: op || "custom", from: fromUsername || "staff",
        role: fromRole || "admin", params, ts: ts(),
    });
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
