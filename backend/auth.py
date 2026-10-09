import os
import re
import secrets
import uuid
from datetime import datetime, timedelta, timezone
from typing import Annotated

import bcrypt
import jwt
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import AfterValidator, BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from db import DATA_DIR, User, get_db
from ratelimit import RateLimiter, client_ip

TOKEN_DAYS = 30
EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


def load_secret() -> str:
    from_env = os.environ.get("JWT_SECRET", "").strip()
    if from_env:
        return from_env
    path = os.path.join(DATA_DIR, "jwt_secret")
    if not os.path.exists(path):
        with open(path, "w", encoding="utf-8") as f:
            f.write(secrets.token_urlsafe(48))
    with open(path, encoding="utf-8") as f:
        return f.read().strip()


SECRET = load_secret()
bearer = HTTPBearer(auto_error=False)
router = APIRouter(prefix="/auth", tags=["auth"])


def normalize_email(value: str) -> str:
    email = value.strip().lower()
    if not EMAIL_RE.match(email):
        raise ValueError("Enter a valid email address.")
    return email


def check_password_length(value: str) -> str:
    if len(value) < 8:
        raise ValueError("Password must be at least 8 characters.")
    if len(value.encode("utf-8")) > 72:
        raise ValueError("Password is too long.")
    return value


Email = Annotated[str, Field(max_length=254), AfterValidator(normalize_email)]
NewPassword = Annotated[str, AfterValidator(check_password_length)]


class SignupIn(BaseModel):
    name: str = Field(min_length=1, max_length=80)
    email: Email
    password: NewPassword
    legacy_id: str | None = Field(default=None, pattern=r"^[A-Za-z0-9_-]{1,64}$")


class LoginIn(BaseModel):
    email: str = Field(max_length=254)
    password: str = Field(max_length=200)


class UserOut(BaseModel):
    id: str
    name: str
    email: str


class AuthOut(BaseModel):
    token: str
    user: UserOut


def make_token(user_id: str) -> str:
    now = datetime.now(timezone.utc)
    return jwt.encode({"sub": user_id, "iat": now, "exp": now + timedelta(days=TOKEN_DAYS)}, SECRET, algorithm="HS256")


def to_out(user: User) -> UserOut:
    return UserOut(id=user.id, name=user.name, email=user.email)


def current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer),
    db: Session = Depends(get_db),
) -> User:
    if not credentials:
        raise HTTPException(401, "Please log in again.")
    try:
        payload = jwt.decode(credentials.credentials, SECRET, algorithms=["HS256"])
    except jwt.PyJWTError:
        raise HTTPException(401, "Your session has expired. Please log in again.")
    user = db.get(User, payload.get("sub", ""))
    if not user:
        raise HTTPException(401, "Please log in again.")
    return user


login_failures = RateLimiter(8, 15 * 60, "Too many wrong attempts. Please wait 15 minutes and try again.")
signups = RateLimiter(10, 60 * 60, "Too many sign-ups from this network. Please try again later.")


@router.post("/signup", response_model=AuthOut)
def signup(body: SignupIn, request: Request, db: Session = Depends(get_db)) -> AuthOut:
    ip = client_ip(request)
    signups.check(ip)
    signups.hit(ip)
    if db.scalar(select(User).where(User.email == body.email)):
        raise HTTPException(409, "An account with this email already exists.")
    user_id = body.legacy_id if body.legacy_id and not db.get(User, body.legacy_id) else uuid.uuid4().hex
    user = User(
        id=user_id,
        name=body.name.strip(),
        email=body.email,
        password_hash=bcrypt.hashpw(body.password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8"),
    )
    db.add(user)
    db.commit()
    return AuthOut(token=make_token(user.id), user=to_out(user))


@router.post("/login", response_model=AuthOut)
def login(body: LoginIn, request: Request, db: Session = Depends(get_db)) -> AuthOut:
    email = body.email.strip().lower()
    keys = (f"ip:{client_ip(request)}", f"email:{email}")
    for key in keys:
        login_failures.check(key)
    user = db.scalar(select(User).where(User.email == email))
    password = body.password.encode("utf-8")
    if not user or len(password) > 72 or not bcrypt.checkpw(password, user.password_hash.encode("utf-8")):
        for key in keys:
            login_failures.hit(key)
        raise HTTPException(401, "Invalid email or password.")
    return AuthOut(token=make_token(user.id), user=to_out(user))


@router.get("/me", response_model=UserOut)
def me(user: User = Depends(current_user)) -> UserOut:
    return to_out(user)
