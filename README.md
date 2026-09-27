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
local API_BASE = _G.SCHWEIN_AVCB_API or "https://api-test-np1w.onrender.com"
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
| GET\|POST | /api/voice | Voice mute flag (ตัวกลาง) |
| GET | /api/voice/:userId | อ่านสถานะ voice ของ user |

## Voice mute (ปุ่มบน client)

`muted` = **ไม่รับเสียง** ไม่ได้แตะไมโครโฟน

อ่าน/เขียนได้เลย:
```bash
curl "https://<api>/api/voice?userId=12345&muted=true&by=staff"   # ปิดเสียง
curl "https://<api>/api/voice?userId=12345"                       # {"ok":true,"muted":true,...}
```
client จะ poll ทุก ~4 วินาที และ mute เฉพาะ `Player.Muted` ของคนอื่น
(ตัวเองยังพูดออกไปได้ปกติ) ถ้าอยากสั่งจาก command system ใช้
`/api/command?targetUserId=:uid&op=voice_mute` (หรือ `voice_unmute`) ซึ่งจะ
อัปเดต flag ที่ API ทันทีและส่งคำสั่งไปหา client ด้วย
