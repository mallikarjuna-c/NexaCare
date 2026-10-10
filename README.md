# NexaCare

**People · Health · Together**

NexaCare is a personal and family health app for Android. It keeps health records, appointments,
medicines, expenses and smartwatch readings in one place. It also links family members' accounts so
you can look after a parent's health from your own phone, and connects people who need blood with
compatible donors nearby.

## Features

### Health
- **Health Records**: vitals, lab reports, prescriptions and other records with attachments, filters
  and detail views. Heart rate and blood pressure can be entered by hand or read from a smartwatch.
- **Smartwatch**: heart rate, resting heart rate, HRV, SpO₂, respiratory rate, blood pressure, steps
  and sleep through Health Connect.
- **Health Trends**: 7-day and 30-day charts.
- **Share Data**: a PDF health summary to send to a doctor.
- **Health Assistant**: an AI chat for general health questions. The user can choose to share their
  Medical ID and watch readings with it. It points to 112 and SOS for emergency symptoms.

### Care and reminders
- **Reminders**: medicines and daily check-ins with a week view, an adherence score and actions
  (Taken, Snooze, Skip) right on the notification.
- **Follow-ups**: appointments, tests and reviews with reminders.
- **Notifications**: an inbox of everything the app has sent, with an unread badge.
- **Medical Expenses**: bills, medicines and insurance claims with receipts and a monthly summary.
- **Directory**: saved doctors, clinics and pharmacies.
- **Challenges**: steps, hydration, sleep and other goals, with automatic progress from the watch.

### Family
- **Family members**: add people without a phone (a child or an elderly parent) and keep their
  records, follow-ups, Medical ID and expenses separately.
- **Linked accounts**: a family member with their own phone shares a code (`NX-XXXXXX`). After they
  approve, you can view, or view and edit, their data from your phone.

### Community
- **Blood and help requests**: ask for blood, platelets or plasma. The request goes only to willing
  donors in the same city whose blood group is compatible, as an instant push notification.
- **Donor settings**: blood group, city, phone number and last donation date. Donors who gave blood
  in the last 90 days are not alerted.
- **Home alert**: an urgent request that matches you appears at the top of the Home screen.

### Safety
- **SOS**: alerts trusted contacts with your location. Also available as a home-screen shortcut.
- **Emergency**: contacts, Medical ID (blood group, allergies, conditions, medicines) and helplines.
  The Medical ID works offline.

## How it works

```
Android app (React Native, Expo)
        │  HTTPS + login token
        ▼
FastAPI server (Render) ──► PostgreSQL (Neon)
        │                └► Groq (Health Assistant)
        └──► Firebase Cloud Messaging ──► push notifications on donors' phones
```

- The app talks only to the NexaCare server. API keys stay on the server and are never in the app.
- Each account's data is stored on the server per person and collection (records, follow-ups,
  expenses, Medical ID, watch, reminders, challenges). The app keeps an offline copy.
- Family members without their own account are stored on the phone and backed up to the owner's
  account.
- Reminders are scheduled on the phone, so they work without internet.

## Tech stack

| Part | Technology |
|---|---|
| Mobile app | React Native 0.86, Expo SDK 57, TypeScript, React Navigation |
| Device features | Health Connect, expo-notifications, expo-location, expo-print, expo-sharing |
| Server | Python 3.13, FastAPI, SQLAlchemy, Uvicorn |
| Database | PostgreSQL 17 (Neon online, Docker locally) |
| Auth | bcrypt password hashes, 30-day JWT tokens, rate limits on login, sign-up and link codes |
| AI | Groq, `openai/gpt-oss-120b` |
| Push | Firebase Cloud Messaging HTTP v1 |
| Hosting | Render (Docker), Neon |

## Project structure

```
NexaCare/
├── mobile/                 Android app
│   ├── App.tsx
│   ├── app.json            app name, package (com.nexacare.app), permissions
│   ├── plugins/            Expo config plugins
│   └── src/
│       ├── screens/        one file per screen
│       ├── components/     shared UI pieces
│       ├── navigation/     tabs and stacks
│       ├── context/        signed-in user and family profiles
│       ├── services/       all storage, server and device access
│       ├── types/          data types and pure helpers
│       └── theme/          colours, spacing and typography
├── backend/                API server
│   ├── main.py             app setup and Health Assistant
│   ├── auth.py             sign-up, login, tokens
│   ├── data.py             per-profile data storage
│   ├── links.py            family account links
│   ├── community.py        donors and blood requests
│   ├── push.py             Firebase push sending
│   ├── db.py               database tables
│   ├── Dockerfile
│   └── compose.yaml        local server and database
└── render.yaml             Render deployment
```

## Running locally

### Server

Requires Docker Desktop.

1. Copy `backend/.env.example` to `backend/.env` and add a Groq API key from
   https://console.groq.com.
2. To enable push, put the Firebase service account key at
   `backend/data/firebase-service-account.json`.
3. Start it:

   ```bash
   cd backend
   docker compose up -d --build
   ```

4. Open http://localhost:8010/health to check it's running.

More details are in [backend/README.md](backend/README.md).

### App

Requires Node.js, Android Studio (SDK and platform tools) and an Android phone with USB debugging.

1. Install dependencies:

   ```bash
   cd mobile
   npm install
   ```

2. Add `google-services.json` from the Firebase project to `mobile/` and `mobile/android/app/`.
3. Build and install the development app:

   ```bash
   npx expo run:android
   ```

4. Later, start the bundler and connect the phone to the local server:

   ```bash
   npm run phone
   ```

Development builds use the server at `localhost:8010`. It can be changed on the Login screen under
**Server**.

## Deployment

### Server

The server deploys to Render from `render.yaml`. Every push to `main` redeploys it.

Environment variables set in Render:

| Variable | Value |
|---|---|
| `DATABASE_URL` | Neon connection string (direct, not pooled) |
| `GROQ_API_KEY` | Groq API key |
| `FCM_SERVICE_ACCOUNT_JSON` | contents of the Firebase service account key |
| `JWT_SECRET` | generated by Render |

On the free plan the server sleeps after 15 minutes without requests, and the next request takes
about 50 seconds. The app wakes it when it opens.

### App

Release builds use the address in `mobile/.env.production`:

```
EXPO_PUBLIC_API_URL=https://nexacare-api.onrender.com
```

Build the APK:

```bash
cd mobile/android
./gradlew app:assembleRelease
```

The file is created at `mobile/android/app/build/outputs/apk/release/app-release.apk` and can be
installed on any Android phone.

## Security and privacy

- Passwords are stored only as bcrypt hashes.
- API keys and the Firebase key live only on the server and are never committed. `backend/.env`,
  `backend/data/` and `google-services.json` are git-ignored.
- Linked accounts see someone's data only after that person approves, and the owner can change or
  remove access at any time.
- A donor's phone number is shown only to the person whose request they answered.
- Requests reported by three people are hidden.
- The Health Assistant gives general information only and is not a substitute for a doctor.

## License

[MIT](LICENSE)
