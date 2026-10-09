import secrets
import uuid
from datetime import datetime, timedelta, timezone
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import delete, or_, select
from sqlalchemy.orm import Session

from auth import UserOut, current_user, to_out
from db import Link, ShareCode, User, get_db
from ratelimit import RateLimiter

ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
CODE_HOURS = 24
Access = Literal["view", "edit"]

router = APIRouter(prefix="/links", tags=["links"])
code_failures = RateLimiter(10, 15 * 60, "Too many wrong codes. Please wait 15 minutes and try again.")


class CodeOut(BaseModel):
    code: str
    expires_at: datetime


class RequestIn(BaseModel):
    code: str = Field(min_length=4, max_length=20)


class AccessIn(BaseModel):
    access: Access


class LinkOut(BaseModel):
    id: str
    person: UserOut
    status: str
    access: str


class LinksOut(BaseModel):
    sharing: list[LinkOut]
    viewing: list[LinkOut]


def normalize_code(raw: str) -> str:
    cleaned = "".join(ch for ch in raw.upper() if ch.isalnum())
    if cleaned.startswith("NX"):
        cleaned = cleaned[2:]
    return f"NX-{cleaned}"


def as_utc(value: datetime) -> datetime:
    return value if value.tzinfo else value.replace(tzinfo=timezone.utc)


def link_out(db: Session, link: Link, other_id: str) -> LinkOut:
    other = db.get(User, other_id)
    if not other:
        raise HTTPException(404, "This person's account no longer exists.")
    return LinkOut(id=link.id, person=to_out(other), status=link.status, access=link.access)


def owned_link(db: Session, link_id: str, user: User) -> Link:
    link = db.get(Link, link_id)
    if not link or link.owner_id != user.id:
        raise HTTPException(404, "Connection not found.")
    return link


@router.post("/code", response_model=CodeOut)
def create_code(user: User = Depends(current_user), db: Session = Depends(get_db)) -> CodeOut:
    db.execute(delete(ShareCode).where(ShareCode.owner_id == user.id))
    code = "NX-" + "".join(secrets.choice(ALPHABET) for _ in range(6))
    expires_at = datetime.now(timezone.utc) + timedelta(hours=CODE_HOURS)
    db.add(ShareCode(code=code, owner_id=user.id, expires_at=expires_at))
    db.commit()
    return CodeOut(code=code, expires_at=expires_at)


@router.post("/request", response_model=LinkOut)
def request_link(body: RequestIn, user: User = Depends(current_user), db: Session = Depends(get_db)) -> LinkOut:
    code_failures.check(user.id)
    share = db.get(ShareCode, normalize_code(body.code))
    if not share or as_utc(share.expires_at) < datetime.now(timezone.utc):
        code_failures.hit(user.id)
        raise HTTPException(404, "That code isn't valid or has expired. Ask for a new one.")
    if share.owner_id == user.id:
        raise HTTPException(400, "That's your own code. Enter the code from the other person's phone.")
    link = db.scalar(select(Link).where(Link.owner_id == share.owner_id, Link.viewer_id == user.id))
    if link and link.status == "approved":
        raise HTTPException(409, "You're already connected to this person.")
    if not link:
        link = Link(id=uuid.uuid4().hex, owner_id=share.owner_id, viewer_id=user.id, status="pending", access="view")
        db.add(link)
        db.commit()
    return link_out(db, link, share.owner_id)


@router.get("", response_model=LinksOut)
def list_links(user: User = Depends(current_user), db: Session = Depends(get_db)) -> LinksOut:
    links = db.scalars(select(Link).where(or_(Link.owner_id == user.id, Link.viewer_id == user.id))).all()
    sharing, viewing = [], []
    for link in links:
        if not db.get(User, link.owner_id) or not db.get(User, link.viewer_id):
            continue
        if link.owner_id == user.id:
            sharing.append(link_out(db, link, link.viewer_id))
        else:
            viewing.append(link_out(db, link, link.owner_id))
    return LinksOut(sharing=sharing, viewing=viewing)


@router.post("/{link_id}/approve", response_model=LinkOut)
def approve_link(link_id: str, body: AccessIn, user: User = Depends(current_user), db: Session = Depends(get_db)) -> LinkOut:
    link = owned_link(db, link_id, user)
    link.status = "approved"
    link.access = body.access
    db.commit()
    return link_out(db, link, link.viewer_id)


@router.patch("/{link_id}", response_model=LinkOut)
def change_access(link_id: str, body: AccessIn, user: User = Depends(current_user), db: Session = Depends(get_db)) -> LinkOut:
    link = owned_link(db, link_id, user)
    link.access = body.access
    db.commit()
    return link_out(db, link, link.viewer_id)


@router.delete("/{link_id}")
def remove_link(link_id: str, user: User = Depends(current_user), db: Session = Depends(get_db)) -> dict:
    link = db.get(Link, link_id)
    if not link or user.id not in (link.owner_id, link.viewer_id):
        raise HTTPException(404, "Connection not found.")
    db.delete(link)
    db.commit()
    return {"ok": True}
