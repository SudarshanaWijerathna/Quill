from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.auth import (
    clear_auth_cookie,
    create_access_token,
    get_current_user,
    get_optional_user,
    hash_password,
    set_auth_cookie,
    verify_password,
)
from app.config import get_settings
from app.db import get_db
from app.models import User
from app.schemas import AuthResponse, LoginRequest, SessionResponse, UserCreate, UserOut

router = APIRouter(prefix="/auth", tags=["auth"])
settings = get_settings()


def _issue_session(response: Response, user: User) -> AuthResponse:
    token = create_access_token(user.id)
    set_auth_cookie(response, token)
    return AuthResponse(access_token=token, user=UserOut.model_validate(user))


@router.post("/register", response_model=AuthResponse, status_code=status.HTTP_201_CREATED)
def register(data: UserCreate, response: Response, db: Session = Depends(get_db)) -> AuthResponse:
    if db.scalar(select(User.id).where(User.email == data.email)) is not None:
        raise HTTPException(status.HTTP_409_CONFLICT, "An account with this email already exists")

    user = User(email=data.email, name=data.name, password_hash=hash_password(data.password))
    db.add(user)
    db.commit()
    db.refresh(user)
    return _issue_session(response, user)


@router.post("/login", response_model=AuthResponse)
def login(data: LoginRequest, response: Response, db: Session = Depends(get_db)) -> AuthResponse:
    user = db.scalar(select(User).where(User.email == data.email))
    # Always run a bcrypt check so timing does not reveal whether the email exists.
    if not verify_password(data.password, user.password_hash if user else None) or user is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid email or password")
    return _issue_session(response, user)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout() -> Response:
    response = Response(status_code=status.HTTP_204_NO_CONTENT)
    clear_auth_cookie(response)
    return response


@router.get("/me", response_model=UserOut)
def me(user: User = Depends(get_current_user)) -> User:
    return user


@router.get("/session", response_model=SessionResponse)
def session(
    request: Request, response: Response, user: User | None = Depends(get_optional_user)
) -> SessionResponse:
    """Session probe used by the SPA on load.

    Being signed out is a normal state here, not an error, so this returns 200 with `user: null`
    instead of 401 (which browsers log as a console error). A cookie that no longer resolves to a
    user (expired, tampered, deleted account) is cleared.
    """
    if user is None and settings.cookie_name in request.cookies:
        clear_auth_cookie(response)
    return SessionResponse(user=UserOut.model_validate(user) if user else None)
