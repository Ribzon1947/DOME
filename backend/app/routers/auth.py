from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    get_current_user,
    verify_password,
)
from app.core.errors import AppException, ErrorCodes
from app.models import User
from app.schemas import LoginRequest, RefreshRequest, TokenResponse, UserResponse

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login", response_model=TokenResponse)
def login(body: LoginRequest, db: Annotated[Session, Depends(get_db)]):
    user = db.query(User).filter(User.email == body.email).first()
    if not user or not verify_password(body.password, user.password_hash):
        raise AppException("Invalid email or password", ErrorCodes.AUTH, 401)
    if not user.is_active:
        raise AppException("Account is inactive", ErrorCodes.AUTH, 401)
    return TokenResponse(
        access_token=create_access_token(user.email, user.role.value),
        refresh_token=create_refresh_token(user.email),
    )


@router.post("/refresh", response_model=TokenResponse)
def refresh(body: RefreshRequest, db: Annotated[Session, Depends(get_db)]):
    payload = decode_token(body.refresh_token, "refresh")
    email = payload.get("sub")
    user = db.query(User).filter(User.email == email).first()
    if not user or not user.is_active:
        raise AppException("User not found", ErrorCodes.AUTH, 401)
    return TokenResponse(
        access_token=create_access_token(user.email, user.role.value),
        refresh_token=create_refresh_token(user.email),
    )


@router.get("/me", response_model=UserResponse)
def me(user: Annotated[User, Depends(get_current_user)]):
    return user
