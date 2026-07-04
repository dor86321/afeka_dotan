# Mobile AED LoRa Emergency Network — מצגת הגנה

> **הוראה:** מלאו את השדות המסומנים `[...]` לפני ההגנה.

---

## שקף 1 — פרטי הפרויקט והצוות

**שם הפרויקט:** Mobile AED LoRa Emergency Network  
**קורס:** טכנולוגיות Web (10266)  
**נושא:** פלטפורמה לסימולציה של איתור והתרעת AED ניידים בזמן דום לב (LoRa + סלולר)

### מבצעי הפרויקט

| # | שם מלא | ת.ז. / מספר סטודנט |
|---|--------|---------------------|
| 1 | Dor Dotan | [מספר] |
| 2 | [שם מלא] | [מספר] |
| 3 | [שם מלא] | [מספר] |

### מיקום GitHub

- **Repository:** [https://github.com/dor86321/afeka_dotan](https://github.com/dor86321/afeka_dotan)
- **תיקיית הפרויקט:** `mobile-aed-lora-emergency-network/`
- **README:** `mobile-aed-lora-emergency-network/README.md`

### מיקום בענן (Deployment)

- **Frontend (Next.js):** `[https://your-app.vercel.app]`
- **Backend API:** `[https://your-api.example.com]` *(או localhost:4000)*
- **Simulator Service:** `[https://your-simulator.example.com]` *(או localhost:4200)*

---

## שקף 2 — Known Bugs / בעיות ידועות

| # | בעיה | חומרה | סטטוס | הערות |
|---|------|--------|--------|-------|
| 1 | חיפוש כתובת (Nominatim) — עלול להיות איטי | נמוכה | ידוע | סימון על המפה / "מיקום ליד מתנדב" |
| 2 | מסלולי ניווט — Polyline סימולטיבי | נמוכה | by design | ETA משוער |
| 3 | אין SMS/Push/LoRa אמיתי | — | by design | פרויקט קורס |
| 4 | צליל התרעה — דפדפן דורש tap ראשון | נמוכה | ידוע | הקשה על מסך המתנדב |
| 5 | JWT access token — 15 דקות | נמוכה | ידוע | logout + login |

---

## שקף 3 — מבנה ארכיטקטוני

```
Frontend (:3000)  →  Backend Express (:4000, SQL)  →  Simulator (:4200, NoSQL)
/login · /volunteer · /simulator · /admin · /registration
```

### זרימת חירום

1. מתנדב נרשם + מתחבר → `/volunteer`
2. אדמין יוצר אירוע → התרעה לכל המתנדבים המחוברים
3. מתנדב: צליל + אישור → הגעה → סגירה
4. סימולטור מתאפס אוטומטית

---

## שקף 4 — JWT Authentication

**קובץ:** `backend/src/auth.ts` — Admin + Volunteer tokens, `requireAdmin`, `requireVolunteer`

---

## שקף 5 — התרעה למתנדבים מחוברים

**קובץ:** `backend/src/server.ts` — סינון online, דירוג, `dispatchHybridAlerts`, `VolunteerAlert`

---

## שקף 6 — Volunteer Alert + Sound

**Backend:** `backend/src/alerting.ts` — יצירת `VolunteerAlert`  
**Frontend:** `frontend/src/lib/alert-sound.ts` — Web Audio pop + vibration

---

## שקף 7 — NoSQL Event Log

**קובץ:** `simulator-service/src/server.ts` — timeline events ב-JSON

---

## שקף 8 — Prisma Schema

`VolunteerAlert`, `Incident`, `AEDDevice`, `User` — seed ~50 AED, admin `micha/1234`

---

## שקף 9 — הדגמה חיה (2 מסכים)

| מסך | URL | פעולה |
|-----|-----|--------|
| Mobile | `/volunteer` | הרשמה, התחברות, קבלת התרעה |
| Desktop | `/simulator` | יצירת אירוע, מעקב, סגירה |

1. Mobile: הרשמה + התחברות  
2. Desktop: מתנדב מחובר → מיקום ליד מתנדב → צור קריאה  
3. Mobile: התרעה + צליל → accept → arrive → close  
4. Desktop: איפוס אוטומטי

---

## שקף 10 — סיכום

Next.js · Express · Prisma · JWT · NoSQL · Leaflet · עברית · אפליקציית מתנדב · סימולטור live

**תודה!**

---

## נספח

- Admin: `micha` / `1234`
- Volunteer: שם פרטי + טלפון מההרשמה
