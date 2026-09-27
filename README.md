# AVCB API — Schwein Anti-VoiceChat-Ban Backend

Backend API server สำหรับ Schwein AVCB Luau script

## วิธี Deploy บน Render (ฟรี)

1. สร้างบัญชีที่ https://render.com
2. New > Web Service > Connect your Git repo (อัพ folder นี้ขึ้น GitHub ก่อน)
3. ตั้งค่า:
   - **Build Command**: `npm install`
   - **Start Command**: `node server.js`
   - **Plan**: Free
4. Deploy แล้วรอได้ URL เช่น `https://avcb-api.onrender.com`

## วิธีใช้ใน Script

ตั้งก่อน execute script:
```lua
_G.SCHWEIN_AVCB_API = "https://your-url.onrender.com"
```

หรือ แก้ไนในบรรทัด:
```lua
local API_BASE = _G.SCHWEIN_AVCB_API or "https://avcb-1o3g.onrender.com"
```
เปลี่ยน default URL เป็น URL ของตัวเอง

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | /api/heartbeat | Presence tracking |
| GET | /api/admins | Admin list |
| GET | /api/users | All online users |
| GET | /api/users?claim=:uid | User claim + pending commands |
| GET | /api/commands/:userId | Pending commands for user |
| GET\|POST | /api/command | Staff sends command to user |
| POST | /api/inbox | Staff inbox message |
| GET | /api/inbox/:userId | Fetch inbox message |
| GET\|POST | /api/chat | Chat system |
| GET | /api/chat/:userId | Fetch chat for user |
