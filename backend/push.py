import json
import logging
import os
import time
from typing import Any

import httpx
from google.auth.transport.requests import Request as GoogleRequest
from google.oauth2 import service_account

from db import DATA_DIR, DeviceToken, SessionLocal

log = logging.getLogger("nexacare.push")

SCOPE = "https://www.googleapis.com/auth/firebase.messaging"
_credentials: service_account.Credentials | None = None
_project_id: str | None = None
_loaded = False


def _load() -> None:
    global _credentials, _project_id, _loaded
    _loaded = True
    raw = os.environ.get("FCM_SERVICE_ACCOUNT_JSON", "").strip()
    path = os.environ.get("FCM_SERVICE_ACCOUNT_FILE", os.path.join(DATA_DIR, "firebase-service-account.json"))
    info: dict[str, Any] | None = None
    if raw:
        info = json.loads(raw)
    elif os.path.exists(path):
        with open(path, encoding="utf-8") as f:
            info = json.load(f)
    if not info:
        log.info("Push disabled: no Firebase service account configured.")
        return
    _credentials = service_account.Credentials.from_service_account_info(info, scopes=[SCOPE])
    _project_id = info.get("project_id")


def push_enabled() -> bool:
    if not _loaded:
        _load()
    return _credentials is not None and bool(_project_id)


def _access_token() -> str:
    assert _credentials is not None
    if not _credentials.valid or (_credentials.expiry and _credentials.expiry.timestamp() - time.time() < 120):
        _credentials.refresh(GoogleRequest())
    return _credentials.token


def send_to_users(user_ids: list[str], title: str, message: str, data: dict[str, Any], channel: str = "community") -> int:
    if not user_ids or not push_enabled():
        return 0
    with SessionLocal() as db:
        tokens = [t.token for t in db.query(DeviceToken).filter(DeviceToken.user_id.in_(user_ids)).all()]
    if not tokens:
        return 0
    url = f"https://fcm.googleapis.com/v1/projects/{_project_id}/messages:send"
    headers = {"Authorization": f"Bearer {_access_token()}"}
    payload_data = {
        "title": title,
        "message": message,
        "body": json.dumps(data),
        "channelId": channel,
    }
    sent = 0
    stale: list[str] = []
    with httpx.Client(timeout=10) as client:
        for token in tokens:
            body = {"message": {"token": token, "data": payload_data, "android": {"priority": "high"}}}
            try:
                response = client.post(url, headers=headers, json=body)
            except httpx.HTTPError as error:
                log.warning("Push request failed: %s", error)
                continue
            if response.status_code == 200:
                sent += 1
            elif response.status_code in (400, 404) and ("UNREGISTERED" in response.text or "INVALID_ARGUMENT" in response.text):
                stale.append(token)
            else:
                log.warning("Push rejected (%s): %s", response.status_code, response.text[:200])
    if stale:
        with SessionLocal() as db:
            db.query(DeviceToken).filter(DeviceToken.token.in_(stale)).delete(synchronize_session=False)
            db.commit()
    return sent
