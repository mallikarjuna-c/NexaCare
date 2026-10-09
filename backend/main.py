import logging
import os
from typing import Literal

import groq
from fastapi import Depends, FastAPI, HTTPException
from pydantic import BaseModel, Field, field_validator

from auth import current_user, router as auth_router
from data import router as data_router
from links import router as links_router
from db import User, init_db

logging.basicConfig(level=logging.INFO)
log = logging.getLogger("nexacare")

MODEL = os.environ.get("GROQ_MODEL", "").strip() or "openai/gpt-oss-120b"
MAX_HISTORY = 20

SYSTEM_PROMPT = """You are the Health Assistant inside NexaCare, a personal health app used mainly in India. People ask you about symptoms, readings from their smartwatch or lab reports, medicines, everyday wellbeing, and how to look after their health.

How to help:
- Give clear, general health information in plain, friendly language. Most readers are not medical professionals and are reading on a phone, so keep answers short (usually under 150 words). Format for a small screen: short paragraphs, "- " bullet lists or numbered lists for steps, and **bold** for the few key words or numbers. Don't use tables, and use at most one short "### " heading.
- You are not the person's doctor and cannot examine them, so do not diagnose or tell them they definitely have or don't have a condition. You can explain what a symptom or reading commonly means, what is typical, what usually helps, and when it is worth seeing a doctor and how soon.
- Don't prescribe medicines or suggest changing doses. For questions about their own medicines, give general information and suggest they check with their doctor or pharmacist.
- If the person describes signs of a medical emergency (for example chest pain or pressure, trouble breathing, stroke signs such as face drooping, arm weakness or slurred speech, severe bleeding, fainting, a seizure, a severe allergic reaction, or poisoning), start your reply by telling them to call 112 now or press the SOS button in the app. Keep the rest brief.
- If someone mentions thoughts of suicide or self-harm, respond with care, encourage them to reach out right now, and share Tele-MANAS (14416), India's free 24/7 mental health helpline, and 112 if they are in immediate danger.
- If a question isn't about health or wellbeing, say briefly that you can only help with health topics.
- If you aren't sure about something, say so rather than guessing.

Health data: the person may choose to share data from the app (their Medical ID and recent smartwatch readings). It appears in a <health_context> block. Use it when it is relevant to their question and say which reading you mean. Never invent readings, dates or values that aren't there; if you need a number they haven't shared, ask for it. Smartwatch readings are approximate wellness measurements, not medical tests."""


class ChatTurn(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(min_length=1, max_length=4000)


class ChatRequest(BaseModel):
    messages: list[ChatTurn] = Field(min_length=1, max_length=60)
    health_context: str | None = Field(default=None, max_length=4000)

    @field_validator("messages")
    @classmethod
    def ends_with_user(cls, messages: list[ChatTurn]) -> list[ChatTurn]:
        if messages[-1].role != "user":
            raise ValueError("the last message must be from the user")
        return messages


class ChatResponse(BaseModel):
    reply: str
    refused: bool = False


init_db()
app = FastAPI(title="NexaCare API")
app.include_router(auth_router)
app.include_router(data_router)
app.include_router(links_router)


def api_key() -> str:
    return os.environ.get("GROQ_API_KEY", "").strip()


_client: groq.AsyncGroq | None = None


def get_client() -> groq.AsyncGroq:
    global _client
    if _client is None:
        _client = groq.AsyncGroq(api_key=api_key(), timeout=60.0, max_retries=2)
    return _client


@app.get("/health")
async def health() -> dict:
    return {"status": "ok", "provider": "groq", "model": MODEL, "api_key_configured": bool(api_key())}


@app.post("/assistant/chat", response_model=ChatResponse)
async def chat(body: ChatRequest, _user: User = Depends(current_user)) -> ChatResponse:
    if not api_key():
        raise HTTPException(503, "The assistant isn't set up yet: add GROQ_API_KEY to backend/.env.")

    turns = body.messages[-MAX_HISTORY:]
    while turns and turns[0].role != "user":
        turns = turns[1:]

    system = SYSTEM_PROMPT
    if body.health_context:
        system += (
            "\n\nThe user chose to share this data from the app:\n"
            f"<health_context>\n{body.health_context}\n</health_context>"
        )

    try:
        completion = await get_client().chat.completions.create(
            model=MODEL,
            messages=[{"role": "system", "content": system}, *[t.model_dump() for t in turns]],
            max_completion_tokens=2000,
            temperature=0.4,
            **({"reasoning_effort": "low", "include_reasoning": False} if MODEL.startswith("openai/gpt-oss") else {}),
        )
    except (groq.AuthenticationError, groq.PermissionDeniedError):
        log.error("Groq rejected the API key")
        raise HTTPException(503, "The assistant's API key isn't valid. Check backend/.env.")
    except groq.RateLimitError:
        raise HTTPException(429, "The free AI limit was reached for now. Try again in a minute.")
    except groq.BadRequestError as e:
        log.error("Bad request to Groq: %s", e.message)
        raise HTTPException(502, "The assistant couldn't handle that request.")
    except groq.APIStatusError as e:
        log.error("Groq error %s", e.status_code)
        raise HTTPException(503, "The AI service is busy right now. Try again shortly.")
    except groq.APIConnectionError:
        raise HTTPException(504, "The server couldn't reach the AI service. Check the PC's internet connection.")

    choice = completion.choices[0]
    reply = (choice.message.content or "").strip()
    if not reply:
        log.error("Empty reply (finish_reason=%s)", choice.finish_reason)
        raise HTTPException(502, "The assistant didn't reply. Please try again.")
    if choice.finish_reason == "length":
        reply += "\n\n(My reply was cut short. Ask me to continue.)"
    return ChatResponse(reply=reply)
