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
| GET | /api/commands/:userId | Pending commands for user (drains the queue) |
| GET\|POST | /api/command | Staff sends command to user |
| POST | /api/inbox | Staff inbox message |
| GET | /api/inbox/:userId | Fetch inbox message |
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

## Nametag sync

`/api/heartbeat` รับและเก็บ state ของ nametag แล้วตอบ `users` กลับมาทั้งรายการ
(client เลยไม่ต้องยิงเพิ่ม — heartbeat ทุก 3 วินาทีคือจุดเดียวที่ต้องอ่าน)

| field | ความหมาย |
|---|---|
| `client` | ต้องเป็น `SUNKEN_HUB` ถึงจะถือว่าคนนั้นใช้สคริปต์ — client จะไม่แสดงป้ายให้คนที่ไม่ได้ส่งค่านี้ |
| `tagText` | ข้อความบนป้าย (สูงสุด 48 ตัว) |
| `tagColor` | สีเป็น `"r,g,b"` เช่น `80,220,130` |
| `tagHidden` | `true` = ซ่อนป้าย ไม่ต้องเห็นแม้แต่ role tag |
| `hidetag` | flag เดิม ปิด role tag |

ตัวอย่าง:
```bash
curl "https://<api>/api/heartbeat?userId=12345&username=alpha\
&client=SUNKEN_HUB&version=2&tagText=hello&tagColor=80,220,130&tagHidden=false"
```

`/api/users` และ `/api/users?claim=:uid` คืน `users` เป็นรายการเดียวกัน
(`claim` เพิ่ม `myCommands` + `role`) ผู้ใช้ที่ heartbeat ภายใน 15 นาทีเท่านั้นที่โผล่

## Staff auth ของ /api/command

`/api/command` ไม่เชื่อ `fromUsername` อย่างเดียว เพราะแก้ query string เองได้
ต้องส่ง `fromUserId` มาด้วย และชื่อต้องตรงกับ heartbeat ของ id นั้น

- id ไม่มี heartbeat / ชื่อไม่ตรง → `403 not staff`
- `admins` ใช้ได้เฉพาะ `kick kill bring notify troll voice_mute voice_unmute`
- `owners` ใช้ได้ทุก action
- `web` / `website` / `dashboard` ถือเป็น owner (สำหรับเว็บ)

## วิธีที่ kick / kill / bring มีผล

ฝั่งที่กดปุ่ม **ไม่** ทำอะไรกับตัวผู้เล่นอีกคนโดยตรง ลำดับคือ

1. client ของ staff ส่ง `GET|POST /api/command` ไปที่ API
2. API ตรวจ role แล้ว push ลงคิวของ user เป้าหมาย
3. **script ของเป้าหมาย** poll `GET /api/commands/:userId` แล้วเอาไป execute เอง
   (คิวถูกล้างหลังอ่าน จึงทำงานครั้งเดียว)

ข้อมูลที่ถูก flatten ไว้ที่ระดับ top-level ของ command เพราะ client อ่านตรง ๆ:
`message` (เหตุผล kick), `fromUsername`, `fromUserId`, `fromJobId`, `fromPlaceId`

`fromJobId` / `fromPlaceId` ใช้ตอน bring แล้วหาเจ้าของไม่เจอในเซิร์ฟเวอร์เดียวกัน
→ ค่อย fallback ไป `TeleportService:TeleportToPlaceInstance`

state ทั้งหมดอยู่ใน memory ล้วน Render restart = ข้อมูลหาย

