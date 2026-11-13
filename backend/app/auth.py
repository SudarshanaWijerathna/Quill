"""Password hashing, JWT handling and the current-user dependency."""

from datetime import datetime, timedelta, timezone

import bcrypt
import jwt
from fastapi import Depends, HTTPException, Request, Response, status
from sqlalchemy.orm import Session

from app.config import get_settings
from app.db import get_db
from app.models import User

settings = get_settings()

# Lets login take similar time whether or not the email exists (limits user enumeration).
_DUMMY_HASH = bcrypt.hashpw(b"not-a-real-password", bcrypt.gensalt()).decode()


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode()


def verify_password(password: str, password_hash: str | None) -> bool:
    try:
        return bcrypt.checkpw(password.encode("utf-8"), (password_hash or _DUMMY_HASH).encode())
    except ValueError:
        return False


def create_access_token(user_id: int) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "sub": str(user_id),
        "iat": now,
        "exp": now + timedelta(minutes=settings.jwt_expire_minutes),
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def set_auth_cookie(response: Response, token: str) -> None:
    response.set_cookie(
        key=settings.cookie_name,
        value=token,
        max_age=settings.jwt_expire_minutes * 60,
        httponly=True,
        secure=settings.cookie_secure,
        samesite=settings.cookie_samesite,  # type: ignore[arg-type]
        path="/",
    )


def clear_auth_cookie(response: Response) -> None:
    response.delete_cookie(
        key=settings.cookie_name,
        path="/",
        secure=settings.cookie_secure,
        httponly=True,
        samesite=settings.cookie_samesite,  # type: ignore[arg-type]
    )


def _credentials_error() -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Not authenticated",
        headers={"WWW-Authenticate": "Bearer"},
    )


def _token_from_request(request: Request) -> str | None:
    scheme, _, value = request.headers.get("Authorization", "").partition(" ")
    if scheme.lower() == "bearer" and value:
        return value
    return request.cookies.get(settings.cookie_name)


def user_from_token(token: str | None, db: Session) -> User | None:
    """Return the user for a valid token, or None if it is missing, invalid, expired or orphaned."""
    if not token:
        return None
    try:
        payload = jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
        user_id = int(payload["sub"])
    except (jwt.PyJWTError, KeyError, ValueError):
        return None
    return db.get(User, user_id)


def get_current_user(request: Request, db: Session = Depends(get_db)) -> User:
    """Resolve the authenticated user from a Bearer header or the session cookie (401 if none)."""
    user = user_from_token(_token_from_request(request), db)
    if user is None:
        raise _credentials_error()
    return user


def get_optional_user(request: Request, db: Session = Depends(get_db)) -> User | None:
    """Like get_current_user, but returns None for anonymous requests instead of raising."""
    return user_from_token(_token_from_request(request), db)
