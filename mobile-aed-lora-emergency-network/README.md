# Mobile AED LoRa Emergency Network

פרויקט קורס טכנולוגיות ווב המדגים פלטפורמה לאיתור והתרעת AED ניידים בזמן אירוע דום לב, עם ערוץ היברידי:

- סלולר (Push/SMS מדומה)
- LoRa/Meshtastic (Downlink/Gateway מדומה)

> המערכת היא סימולטור לימודי בלבד ואינה מחליפה שירותי חירום. יש להתקשר מיד ל-101.

## GitHub & Cloud

| | כתובת |
|---|--------|
| **GitHub Repository** | [https://github.com/dor86321/afeka_dotan](https://github.com/dor86321/afeka_dotan) |
| **Project folder** | `mobile-aed-lora-emergency-network/` |
| **Cloud (Frontend)** | `[https://your-app.vercel.app]` — עדכנו לאחר deploy |
| **Presentation slides** | [`slide.md`](./slide.md) |

## Stack

- **Frontend:** Next.js + React + TypeScript + Tailwind + Leaflet
- **Backend API/Auth:** Express + TypeScript + Prisma + SQLite + JWT + refresh token
- **Telemetry/Event Service (NoSQL simulation):** Express + TypeScript + JSON document store

## Architecture

```
Frontend (:3000)
  ├── /login          — התחברות מאוחדת (אדמין + מתנדב)
  ├── /registration   — הרשמת מתנדב + AED
  ├── /volunteer      — אפליקציית מתנדב (mobile-first, התרעות חירום)
  ├── /simulator      — סימולטור אירוע (אדמין בלבד)
  ├── /admin          — לוח ניהול (אדמין בלבד)
  ├── /technology     — תוכן טכנולוגי (אדמין בלבד)
  └── /lora-info      — מידע LoRa (ציבורי)

Backend (:4000)       — SQL/Prisma: users, AED, incidents, volunteer alerts
Simulator (:4200)     — NoSQL JSON: telemetry + incident timeline
```

## SQL vs NoSQL

**SQL** (`backend`/Prisma/SQLite):

- users (כולל `volunteerOnlineAt`, מיקום מתנדב)
- aed devices
- lora devices
- admin users
- simulator config
- incidents (תיאור, קטגוריה, סגירה)
- volunteer alerts
- maintenance alerts

**NoSQL** (`simulator-service`):

- telemetry events (heartbeat/gps/battery/downlink)
- incident timeline events

## Setup

```bash
cd mobile-aed-lora-emergency-network
npm install
npm install --prefix backend
npm install --prefix simulator-service
npm install --prefix frontend
```

Copy frontend env (Windows PowerShell):

```powershell
Copy-Item frontend/.env.local.example frontend/.env.local
```

Copy frontend env (macOS/Linux):

```bash
cp frontend/.env.local.example frontend/.env.local
```

Run migrations + seed:

```bash
npm run seed
```

Start all services:

```bash
npm run dev
```

**Services:**

| Service | URL |
|---------|-----|
| Frontend | http://localhost:3000 |
| Backend | http://localhost:4000 |
| Simulator Service | http://localhost:4200 |


## Environment Variables

**Backend** (`backend/.env`):

- `DATABASE_URL=file:./dev.db`
- `PORT=4000`
- `FRONTEND_URL=http://localhost:3000`
- `SIMULATOR_URL=http://localhost:4200`
- `JWT_ACCESS_SECRET=...`
- `JWT_REFRESH_SECRET=...`

**Frontend** (`frontend/.env.local`):

- `NEXT_PUBLIC_BACKEND_URL=http://localhost:4000`

## API Highlights

**Auth:**

- `POST /auth/login` — אדמין
- `POST /auth/volunteer/login` — מתנדב (שם + טלפון)
- `POST /auth/refresh` · `POST /auth/logout`

**Volunteer:**

- `GET /volunteer/alerts`
- `POST /volunteer/alerts/:id/accept`
- `POST /volunteer/alerts/:id/arrived`
- `POST /volunteer/alerts/:id/close`
- `POST /volunteer/location` · `POST /volunteer/presence` · `POST /volunteer/offline`

**Public:**

- `POST /registrations`
- `GET /public/content` · `GET /public/config`

**Admin:**

- `GET /admin/users` · `GET /admin/stats` · `GET /admin/incidents`
- `PUT /admin/config` · `PUT /admin/content/:pageKey`

**Simulator:**

- `POST /simulator/incidents`
- `GET /simulator/incidents/:id`
- `POST /simulator/incidents/:id/close` — סגירה על ידי אדמין
- `GET /simulator/online-volunteers`
- `POST /simulator/telemetry/heartbeat`

## LoRa/Meshtastic Simulation

When an incident is created, the backend runs **parallel hybrid alerting**:

1. **Cellular** — simulated Push + SMS (`CELLULAR_PUSH`, `CELLULAR_SMS`)
2. **Meshtastic** — encrypted downlink (AES-256, 433 MHz):
   - Gateway → mesh repeaters → `DEVICE_BEEPING`

Modules: `backend/src/meshtastic.ts`, `backend/src/alerting.ts`

Simulator modes (admin config): `noCellularMode` / `noGatewayMode`
