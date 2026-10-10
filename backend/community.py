import re
import uuid
from datetime import date, datetime, timedelta, timezone
from typing import Literal

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from auth import current_user
from db import DeviceToken, DonorProfile, HelpReport, HelpRequest, HelpResponse, User, get_db
from push import push_enabled, send_to_users

router = APIRouter(prefix="/community", tags=["community"])

BloodGroup = Literal["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"]
Kind = Literal["blood", "platelets", "plasma"]
Urgency = Literal["critical", "urgent", "planned"]

RED_CELL_DONORS: dict[str, list[str]] = {
    "O-": ["O-"],
    "O+": ["O+", "O-"],
    "A-": ["A-", "O-"],
    "A+": ["A+", "A-", "O+", "O-"],
    "B-": ["B-", "O-"],
    "B+": ["B+", "B-", "O+", "O-"],
    "AB-": ["AB-", "A-", "B-", "O-"],
    "AB+": ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"],
}
PLASMA_DONOR_ABO: dict[str, list[str]] = {"O": ["O", "A", "B", "AB"], "A": ["A", "AB"], "B": ["B", "AB"], "AB": ["AB"]}
CITY_ALIASES = {
    "bangalore": "bengaluru", "bombay": "mumbai", "madras": "chennai", "calcutta": "kolkata",
    "gurgaon": "gurugram", "trivandrum": "thiruvananthapuram", "mysore": "mysuru", "vizag": "visakhapatnam",
    "poona": "pune", "baroda": "vadodara", "cochin": "kochi",
}
URGENCY_HOURS = {"critical": 24, "urgent": 72, "planned": 7 * 24}
DONATION_GAP_DAYS = 90
MAX_OPEN_REQUESTS = 3
HIDE_AFTER_REPORTS = 3
PHONE_RE = re.compile(r"^\+?[0-9 ()-]{8,18}$")


def normalize_city(raw: str) -> str:
    city = re.sub(r"\s+", " ", raw.strip().lower())
    return CITY_ALIASES.get(city, city)


def compatible_donor_groups(kind: str, group: str) -> list[str]:
    if kind == "plasma":
        abo = group.rstrip("+-")
        return [g for g in RED_CELL_DONORS if g.rstrip("+-") in PLASMA_DONOR_ABO[abo]]
    return RED_CELL_DONORS[group]


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def as_utc(value: datetime) -> datetime:
    return value if value.tzinfo else value.replace(tzinfo=timezone.utc)


class DonorIn(BaseModel):
    city: str = Field(min_length=2, max_length=80)
    blood_group: BloodGroup | None = None
    willing: bool = False
    last_donation: date | None = None
    phone: str = Field(default="", max_length=20)


class DonorOut(BaseModel):
    city: str
    blood_group: str | None
    willing: bool
    last_donation: date | None
    phone: str
    eligible: bool


class DeviceIn(BaseModel):
    token: str = Field(min_length=10, max_length=512)
    platform: Literal["android", "ios"] = "android"


class RequestIn(BaseModel):
    kind: Kind = "blood"
    blood_group: BloodGroup
    units: int = Field(default=1, ge=1, le=10)
    urgency: Urgency
    patient_name: str = Field(min_length=1, max_length=80)
    hospital: str = Field(min_length=2, max_length=120)
    city: str = Field(min_length=2, max_length=80)
    contact_phone: str = Field(min_length=8, max_length=20)
    note: str = Field(default="", max_length=500)


class Responder(BaseModel):
    name: str
    phone: str
    blood_group: str
    responded_at: datetime


class RequestOut(BaseModel):
    id: str
    kind: str
    blood_group: str
    units: int
    urgency: str
    patient_name: str
    hospital: str
    city: str
    contact_phone: str
    note: str
    status: str
    created_at: datetime
    expires_at: datetime
    requester_name: str
    is_mine: bool
    can_donate: bool
    responded: bool
    response_count: int
    notified_count: int
    responders: list[Responder] = []


class CloseIn(BaseModel):
    status: Literal["fulfilled", "closed"]


class ReportIn(BaseModel):
    reason: str = Field(default="", max_length=200)


def donor_eligible(profile: DonorProfile | None) -> bool:
    if not profile or not profile.willing or not profile.blood_group:
        return False
    return profile.last_donation is None or (date.today() - profile.last_donation).days >= DONATION_GAP_DAYS


def expire_old(db: Session) -> None:
    db.query(HelpRequest).filter(HelpRequest.status == "open", HelpRequest.expires_at < utcnow()).update(
        {HelpRequest.status: "expired"}, synchronize_session=False
    )
    db.commit()


def to_out(db: Session, req: HelpRequest, user: User, profile: DonorProfile | None, with_responders: bool) -> RequestOut:
    requester = db.get(User, req.requester_id)
    responses = db.scalars(select(HelpResponse).where(HelpResponse.request_id == req.id)).all()
    is_mine = req.requester_id == user.id
    responders: list[Responder] = []
    if with_responders and is_mine:
        for r in responses:
            donor = db.get(User, r.donor_id)
            donor_profile = db.get(DonorProfile, r.donor_id)
            if donor:
                responders.append(Responder(
                    name=donor.name,
                    phone=donor_profile.phone if donor_profile else "",
                    blood_group=donor_profile.blood_group if donor_profile else "",
                    responded_at=as_utc(r.created_at),
                ))
    can_donate = (
        not is_mine
        and req.status == "open"
        and donor_eligible(profile)
        and profile is not None
        and profile.blood_group in compatible_donor_groups(req.kind, req.blood_group)
    )
    return RequestOut(
        id=req.id, kind=req.kind, blood_group=req.blood_group, units=req.units, urgency=req.urgency,
        patient_name=req.patient_name, hospital=req.hospital, city=req.city_label, contact_phone=req.contact_phone,
        note=req.note, status=req.status, created_at=as_utc(req.created_at), expires_at=as_utc(req.expires_at),
        requester_name=requester.name.split(" ")[0] if requester else "Someone", is_mine=is_mine, can_donate=can_donate,
        responded=any(r.donor_id == user.id for r in responses), response_count=len(responses),
        notified_count=req.notified_count, responders=responders,
    )


def matching_donor_ids(db: Session, req: HelpRequest) -> list[str]:
    groups = compatible_donor_groups(req.kind, req.blood_group)
    cutoff = date.today() - timedelta(days=DONATION_GAP_DAYS)
    rows = db.scalars(
        select(DonorProfile).where(
            DonorProfile.city == req.city,
            DonorProfile.willing.is_(True),
            DonorProfile.blood_group.in_(groups),
            DonorProfile.user_id != req.requester_id,
        )
    ).all()
    return [p.user_id for p in rows if p.last_donation is None or p.last_donation <= cutoff]


@router.get("/donor", response_model=DonorOut | None)
def get_donor(user: User = Depends(current_user), db: Session = Depends(get_db)) -> DonorOut | None:
    profile = db.get(DonorProfile, user.id)
    if not profile:
        return None
    return DonorOut(
        city=profile.city_label, blood_group=profile.blood_group or None, willing=profile.willing,
        last_donation=profile.last_donation, phone=profile.phone, eligible=donor_eligible(profile),
    )


@router.put("/donor", response_model=DonorOut)
def put_donor(body: DonorIn, user: User = Depends(current_user), db: Session = Depends(get_db)) -> DonorOut:
    if body.willing and not body.blood_group:
        raise HTTPException(422, "Choose your blood group to register as a donor.")
    if body.willing and not PHONE_RE.match(body.phone.strip()):
        raise HTTPException(422, "Add a phone number so requesters can reach you.")
    if body.last_donation and body.last_donation > date.today() + timedelta(days=1):
        raise HTTPException(422, "The last donation date can't be in the future.")
    profile = db.get(DonorProfile, user.id) or DonorProfile(user_id=user.id)
    profile.city = normalize_city(body.city)
    profile.city_label = body.city.strip()
    profile.blood_group = body.blood_group or ""
    profile.willing = body.willing
    profile.last_donation = body.last_donation
    profile.phone = body.phone.strip()
    db.merge(profile)
    db.commit()
    return get_donor(user, db)


@router.post("/devices")
def register_device(body: DeviceIn, user: User = Depends(current_user), db: Session = Depends(get_db)) -> dict:
    row = db.get(DeviceToken, body.token)
    if row:
        row.user_id = user.id
        row.platform = body.platform
    else:
        db.add(DeviceToken(token=body.token, user_id=user.id, platform=body.platform))
    db.commit()
    return {"ok": True, "push_enabled": push_enabled()}


@router.delete("/devices/{token}")
def unregister_device(token: str, user: User = Depends(current_user), db: Session = Depends(get_db)) -> dict:
    db.query(DeviceToken).filter(DeviceToken.token == token, DeviceToken.user_id == user.id).delete()
    db.commit()
    return {"ok": True}


@router.post("/requests", response_model=RequestOut)
def create_request(
    body: RequestIn, tasks: BackgroundTasks, user: User = Depends(current_user), db: Session = Depends(get_db)
) -> RequestOut:
    expire_old(db)
    open_count = db.scalar(
        select(func.count()).select_from(HelpRequest).where(HelpRequest.requester_id == user.id, HelpRequest.status == "open")
    )
    if open_count and open_count >= MAX_OPEN_REQUESTS:
        raise HTTPException(429, f"You can have up to {MAX_OPEN_REQUESTS} open requests. Close one first.")
    if not PHONE_RE.match(body.contact_phone.strip()):
        raise HTTPException(422, "Enter a valid contact number, e.g. +91 98765 43210.")
    req = HelpRequest(
        id=uuid.uuid4().hex, requester_id=user.id, kind=body.kind, blood_group=body.blood_group, units=body.units,
        urgency=body.urgency, patient_name=body.patient_name.strip(), hospital=body.hospital.strip(),
        city=normalize_city(body.city), city_label=body.city.strip(), contact_phone=body.contact_phone.strip(),
        note=body.note.strip(), status="open", expires_at=utcnow() + timedelta(hours=URGENCY_HOURS[body.urgency]),
    )
    donors = matching_donor_ids(db, req)
    req.notified_count = len(donors)
    db.add(req)
    db.commit()
    label = "Platelets" if body.kind == "platelets" else "Plasma" if body.kind == "plasma" else "Blood"
    urgent = "URGENT · " if body.urgency == "critical" else ""
    tasks.add_task(
        send_to_users,
        donors,
        f"🩸 {urgent}{body.blood_group} {label.lower()} needed",
        f"{body.units} unit{'s' if body.units > 1 else ''} at {req.hospital}, {req.city_label}. You're a match — tap to help.",
        {"route": {"screen": "HelpRequest", "params": {"requestId": req.id}}, "category": "community"},
    )
    return to_out(db, req, user, db.get(DonorProfile, user.id), with_responders=True)


@router.get("/requests", response_model=list[RequestOut])
def list_requests(
    scope: Literal["nearby", "mine"] = "nearby", user: User = Depends(current_user), db: Session = Depends(get_db)
) -> list[RequestOut]:
    expire_old(db)
    profile = db.get(DonorProfile, user.id)
    if scope == "mine":
        rows = db.scalars(
            select(HelpRequest).where(HelpRequest.requester_id == user.id).order_by(HelpRequest.created_at.desc()).limit(30)
        ).all()
    else:
        if not profile or not profile.city:
            return []
        rows = db.scalars(
            select(HelpRequest)
            .where(HelpRequest.city == profile.city, HelpRequest.status == "open")
            .order_by(HelpRequest.created_at.desc())
            .limit(50)
        ).all()
    return [to_out(db, r, user, profile, with_responders=False) for r in rows]


@router.get("/requests/{request_id}", response_model=RequestOut)
def get_request(request_id: str, user: User = Depends(current_user), db: Session = Depends(get_db)) -> RequestOut:
    expire_old(db)
    req = db.get(HelpRequest, request_id)
    if not req or (req.status == "hidden" and req.requester_id != user.id):
        raise HTTPException(404, "This request is no longer available.")
    return to_out(db, req, user, db.get(DonorProfile, user.id), with_responders=True)


@router.post("/requests/{request_id}/respond", response_model=RequestOut)
def respond(
    request_id: str, tasks: BackgroundTasks, user: User = Depends(current_user), db: Session = Depends(get_db)
) -> RequestOut:
    req = db.get(HelpRequest, request_id)
    if not req or req.status != "open":
        raise HTTPException(404, "This request is no longer open.")
    if req.requester_id == user.id:
        raise HTTPException(400, "This is your own request.")
    profile = db.get(DonorProfile, user.id)
    if not profile or not PHONE_RE.match(profile.phone or ""):
        raise HTTPException(422, "Add your phone number in Donor settings so the family can call you.")
    if not db.scalar(select(HelpResponse).where(HelpResponse.request_id == req.id, HelpResponse.donor_id == user.id)):
        db.add(HelpResponse(id=uuid.uuid4().hex, request_id=req.id, donor_id=user.id))
        db.commit()
        tasks.add_task(
            send_to_users,
            [req.requester_id],
            f"🙌 {user.name.split(' ')[0]} can donate",
            f"{profile.blood_group or 'A donor'} · tap to see their number and call them.",
            {"route": {"screen": "HelpRequest", "params": {"requestId": req.id}}, "category": "community"},
        )
    return to_out(db, req, user, profile, with_responders=True)


@router.post("/requests/{request_id}/close", response_model=RequestOut)
def close_request(
    request_id: str, body: CloseIn, tasks: BackgroundTasks, user: User = Depends(current_user), db: Session = Depends(get_db)
) -> RequestOut:
    req = db.get(HelpRequest, request_id)
    if not req or req.requester_id != user.id:
        raise HTTPException(404, "Request not found.")
    req.status = body.status
    db.commit()
    if body.status == "fulfilled":
        donor_ids = [r.donor_id for r in db.scalars(select(HelpResponse).where(HelpResponse.request_id == req.id)).all()]
        tasks.add_task(
            send_to_users,
            donor_ids,
            "💚 Request fulfilled",
            f"The {req.blood_group} request at {req.hospital} has been met. Thank you for offering to help.",
            {"route": {"screen": "HelpRequest", "params": {"requestId": req.id}}, "category": "community"},
        )
    return to_out(db, req, user, db.get(DonorProfile, user.id), with_responders=True)


@router.post("/requests/{request_id}/report")
def report(request_id: str, body: ReportIn, user: User = Depends(current_user), db: Session = Depends(get_db)) -> dict:
    req = db.get(HelpRequest, request_id)
    if not req:
        raise HTTPException(404, "Request not found.")
    if req.requester_id == user.id:
        raise HTTPException(400, "You can't report your own request.")
    if not db.scalar(select(HelpReport).where(HelpReport.request_id == req.id, HelpReport.reporter_id == user.id)):
        db.add(HelpReport(id=uuid.uuid4().hex, request_id=req.id, reporter_id=user.id, reason=body.reason.strip()))
        db.commit()
    reports = db.scalar(select(func.count()).select_from(HelpReport).where(HelpReport.request_id == req.id)) or 0
    if reports >= HIDE_AFTER_REPORTS and req.status == "open":
        req.status = "hidden"
        db.commit()
    return {"ok": True}
