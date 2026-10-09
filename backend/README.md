# NexaCare backend

A small FastAPI server for the app's **Health Assistant**. It holds the Groq API key and calls
Groq's free-plan model (`openai/gpt-oss-120b` by default). The mobile app only talks to this
server and never sees the key.

It runs in Docker because Windows Smart App Control blocks the compiled packages FastAPI needs
when they're installed directly on Windows.

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

The phone reaches it through `adb reverse tcp:8010 tcp:8010`. That already runs as part of
`npm run phone` and `npm run reconnect` in `mobile/`.

Useful commands:

```bash
docker compose logs -f     # watch server logs
docker compose down        # stop it
```

After editing `main.py` or `.env`, run `docker compose up -d --build` again.

## API

- `GET /health` reports the status, the model, and whether the key is configured.
- `POST /assistant/chat` takes `{ "messages": [{ "role": "user" | "assistant", "content": "..." }], "health_context": "..." | null }`
  and returns `{ "reply": "...", "refused": false }`.

Safety rules live in `SYSTEM_PROMPT` in `main.py`: no diagnosis or dosing, emergency signs lead to
112 and the SOS button, and self-harm leads to Tele-MANAS 14416. The app also shows its own
emergency banner without waiting for the AI.

When "Use my health data" is on in the app, that data is sent to Groq's cloud with the question.

The server listens on `127.0.0.1` only, so other devices on your Wi-Fi can't use your key.
