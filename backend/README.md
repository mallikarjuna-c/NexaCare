# NexaCare backend

A FastAPI server for NexaCare. It handles:

- **Accounts**: sign-up and login with bcrypt-hashed passwords and 30-day login tokens.
- **Health data**: records, follow-ups, expenses, Medical ID and watch summaries for each account.
- **Family links**: share codes, approval, and view-only or edit access between accounts.
- **Health Assistant**: calls Groq (`openai/gpt-oss-120b` by default). The app never sees the Groq key.

Everything runs in Docker (the API plus a PostgreSQL database). Docker is needed because Windows
Smart App Control blocks the compiled packages FastAPI needs when they're installed directly on Windows.

## First-time setup

1. Sign in at https://console.groq.com and create a key under **API Keys**. The free plan has
   daily limits; see https://console.groq.com/settings/limits.
2. Copy `.env.example` to `.env` in this folder and paste the key after `GROQ_API_KEY=`.
   `.env` is git-ignored. Never commit it and never put the key in the mobile app.

## Run it

Open Docker Desktop, then from this folder:

```bash
docker compose up -d --build
```

Check it: http://localhost:8010/health should show `"api_key_configured": true`.

- Your phone (USB or Wireless debugging) reaches it at `localhost:8010` through `adb reverse`, which
  `npm run phone` and `npm run reconnect` in `mobile/` already set up.
- Other phones on the same Wi-Fi use the PC's Wi-Fi address. On the Login screen, tap
  **Server: …** and enter it, e.g. `192.168.1.5`.

Useful commands:

```bash
docker compose logs -f api     # watch server logs
docker compose down            # stop it (data is kept)
```

After editing any `.py` file or `.env`, run `docker compose up -d --build` again.

## Database

- **Locally**, PostgreSQL runs in the `db` container. Its data lives in the Docker volume `pgdata`
  and survives restarts and rebuilds. `docker compose down -v` deletes it, so don't use `-v`
  unless you mean to wipe everything.
- **Online**, put the hosted database's connection string in `.env`:
  `DATABASE_URL=postgresql://user:password@host/dbname?sslmode=require`
  It overrides the local database. Nothing else changes.
- `data/` (git-ignored) also holds `jwt_secret`, the key that signs login tokens. When the server
  goes online, set `JWT_SECRET` in `.env` instead.

## API

- `GET /health` reports the status, the model, and whether the Groq key is configured.
- `POST /auth/signup`, `POST /auth/login`, `GET /auth/me`.
- `GET|PUT /profiles/{id}/data/{records|followups|expenses|medical|watch}`. Allowed for the owner,
  or for a linked account (view only, or view and edit). Only the owner can write `watch`.
- `POST /links/code` creates a 24-hour code. `POST /links/request` sends a request using a code.
  `GET /links` lists links. `POST /links/{id}/approve`, `PATCH /links/{id}` and `DELETE /links/{id}`
  approve, change access and remove.
- `POST /assistant/chat` requires a login.

Safety rules live in `SYSTEM_PROMPT` in `main.py`: no diagnosis or dosing, emergency signs lead to
112 and the SOS button, and self-harm leads to Tele-MANAS 14416. The app also shows its own
emergency banner without waiting for the AI.

When "Use my health data" is on in the app, that data is sent to Groq's cloud with the question.

The API listens on port 8010 on your Wi-Fi so family phones can reach it. Everything except
sign-up, login and `/health` needs a login token. The database container is not exposed outside
Docker.
