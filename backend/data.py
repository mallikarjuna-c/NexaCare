import json
from typing import Any, Literal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session

from auth import current_user
from db import Link, ProfileData, User, get_db

Collection = Literal["records", "followups", "expenses", "medical", "watch", "backup", "reminders", "reminder_logs", "challenges"]
OWNER_ONLY = {"backup"}
MAX_BYTES = 5_000_000

router = APIRouter(prefix="/profiles", tags=["data"])


def access_level(db: Session, user: User, profile_id: str) -> str | None:
    if profile_id == user.id:
        return "owner"
    link = db.scalar(
        select(Link).where(Link.owner_id == profile_id, Link.viewer_id == user.id, Link.status == "approved")
    )
    return link.access if link else None


class DataIn(BaseModel):
    data: Any


class DataOut(BaseModel):
    exists: bool
    data: Any = None
    access: str


@router.get("/{profile_id}/data/{collection}", response_model=DataOut)
def read_data(
    profile_id: str, collection: Collection, user: User = Depends(current_user), db: Session = Depends(get_db)
) -> DataOut:
    level = access_level(db, user, profile_id)
    if not level or (collection in OWNER_ONLY and level != "owner"):
        raise HTTPException(404, "You don't have access to this person's data.")
    row = db.get(ProfileData, (profile_id, collection))
    return DataOut(exists=row is not None, data=json.loads(row.data) if row else None, access=level)


@router.put("/{profile_id}/data/{collection}", response_model=DataOut)
def write_data(
    profile_id: str,
    collection: Collection,
    body: DataIn,
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
) -> DataOut:
    level = access_level(db, user, profile_id)
    if not level:
        raise HTTPException(404, "You don't have access to this person's data.")
    if collection in OWNER_ONLY and level != "owner":
        raise HTTPException(404, "You don't have access to this person's data.")
    if level == "view" or (collection == "watch" and level != "owner"):
        raise HTTPException(403, "You can view this person's data but not change it.")
    encoded = json.dumps(body.data, separators=(",", ":"))
    if len(encoded.encode("utf-8")) > MAX_BYTES:
        raise HTTPException(413, "This is too much data to save at once.")
    row = db.get(ProfileData, (profile_id, collection))
    if row:
        row.data = encoded
    else:
        db.add(ProfileData(profile_id=profile_id, collection=collection, data=encoded))
    db.commit()
    return DataOut(exists=True, data=body.data, access=level)
