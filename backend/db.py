import os
from collections.abc import Iterator
from datetime import date, datetime

from sqlalchemy import Boolean, Date, DateTime, ForeignKey, Integer, String, Text, UniqueConstraint, create_engine, func
from sqlalchemy.orm import DeclarativeBase, Mapped, Session, mapped_column, sessionmaker

DATA_DIR = os.environ.get("DATA_DIR", "/app/data")
os.makedirs(DATA_DIR, exist_ok=True)

def database_url() -> str:
    url = os.environ.get("DATABASE_URL", "").strip()
    if not url:
        raise RuntimeError("DATABASE_URL is not set. Start the server with docker compose, or set it in .env.")
    if url.startswith("postgres://"):
        url = "postgresql://" + url[len("postgres://"):]
    if url.startswith("postgresql://"):
        url = "postgresql+psycopg://" + url[len("postgresql://"):]
    return url


DATABASE_URL = database_url()
engine = create_engine(DATABASE_URL, pool_pre_ping=True)
SessionLocal = sessionmaker(engine, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    name: Mapped[str] = mapped_column(String(80))
    email: Mapped[str] = mapped_column(String(254), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(100))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class ProfileData(Base):
    __tablename__ = "profile_data"

    profile_id: Mapped[str] = mapped_column(String(64), primary_key=True)
    collection: Mapped[str] = mapped_column(String(32), primary_key=True)
    data: Mapped[str] = mapped_column(Text)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class ShareCode(Base):
    __tablename__ = "share_codes"

    code: Mapped[str] = mapped_column(String(16), primary_key=True)
    owner_id: Mapped[str] = mapped_column(String(64), ForeignKey("users.id"), index=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))


class Link(Base):
    __tablename__ = "links"
    __table_args__ = (UniqueConstraint("owner_id", "viewer_id"),)

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    owner_id: Mapped[str] = mapped_column(String(64), ForeignKey("users.id"), index=True)
    viewer_id: Mapped[str] = mapped_column(String(64), ForeignKey("users.id"), index=True)
    status: Mapped[str] = mapped_column(String(16), default="pending")
    access: Mapped[str] = mapped_column(String(16), default="view")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class DeviceToken(Base):
    __tablename__ = "device_tokens"

    token: Mapped[str] = mapped_column(String(512), primary_key=True)
    user_id: Mapped[str] = mapped_column(String(64), ForeignKey("users.id"), index=True)
    platform: Mapped[str] = mapped_column(String(16), default="android")
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class DonorProfile(Base):
    __tablename__ = "donor_profiles"

    user_id: Mapped[str] = mapped_column(String(64), ForeignKey("users.id"), primary_key=True)
    city: Mapped[str] = mapped_column(String(80), index=True, default="")
    city_label: Mapped[str] = mapped_column(String(80), default="")
    blood_group: Mapped[str] = mapped_column(String(4), default="")
    willing: Mapped[bool] = mapped_column(Boolean, default=False)
    last_donation: Mapped[date | None] = mapped_column(Date, nullable=True)
    phone: Mapped[str] = mapped_column(String(20), default="")
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class HelpRequest(Base):
    __tablename__ = "help_requests"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    requester_id: Mapped[str] = mapped_column(String(64), ForeignKey("users.id"), index=True)
    kind: Mapped[str] = mapped_column(String(16))
    blood_group: Mapped[str] = mapped_column(String(4))
    units: Mapped[int] = mapped_column(Integer, default=1)
    urgency: Mapped[str] = mapped_column(String(16))
    patient_name: Mapped[str] = mapped_column(String(80))
    hospital: Mapped[str] = mapped_column(String(120))
    city: Mapped[str] = mapped_column(String(80), index=True)
    city_label: Mapped[str] = mapped_column(String(80))
    contact_phone: Mapped[str] = mapped_column(String(20))
    note: Mapped[str] = mapped_column(Text, default="")
    status: Mapped[str] = mapped_column(String(16), default="open", index=True)
    notified_count: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))


class HelpResponse(Base):
    __tablename__ = "help_responses"
    __table_args__ = (UniqueConstraint("request_id", "donor_id"),)

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    request_id: Mapped[str] = mapped_column(String(64), ForeignKey("help_requests.id"), index=True)
    donor_id: Mapped[str] = mapped_column(String(64), ForeignKey("users.id"), index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class HelpReport(Base):
    __tablename__ = "help_reports"
    __table_args__ = (UniqueConstraint("request_id", "reporter_id"),)

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    request_id: Mapped[str] = mapped_column(String(64), ForeignKey("help_requests.id"), index=True)
    reporter_id: Mapped[str] = mapped_column(String(64), ForeignKey("users.id"))
    reason: Mapped[str] = mapped_column(String(200), default="")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


def init_db() -> None:
    Base.metadata.create_all(engine)


def get_db() -> Iterator[Session]:
    with SessionLocal() as session:
        yield session
