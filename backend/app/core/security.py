import bcrypt

from datetime import datetime, timedelta, timezone
from typing import Annotated

from fastapi import Depends
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.database import get_db
from app.core.errors import AppException, ErrorCodes
from app.models.user import User, UserRole

security = HTTPBearer(auto_error=False)
settings = get_settings()

ALGORITHM = "HS256"


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))


def create_access_token(subject: str, role: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(minutes=settings.access_token_expire_minutes)
    return jwt.encode(
        {"sub": subject, "role": role, "type": "access", "exp": expire},
        settings.secret_key,
        algorithm=ALGORITHM,
    )


def create_refresh_token(subject: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(days=settings.refresh_token_expire_days)
    return jwt.encode(
        {"sub": subject, "type": "refresh", "exp": expire},
        settings.secret_key,
        algorithm=ALGORITHM,
    )


def decode_token(token: str, expected_type: str | None = None) -> dict:
    try:
        payload = jwt.decode(token, settings.secret_key, algorithms=[ALGORITHM])
    except JWTError as exc:
        raise AppException("Invalid or expired token", ErrorCodes.AUTH, 401) from exc
    if expected_type and payload.get("type") != expected_type:
        raise AppException("Invalid token type", ErrorCodes.AUTH, 401)
    return payload


def get_current_user(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(security)],
    db: Annotated[Session, Depends(get_db)],
) -> User:
    if not credentials:
        raise AppException("Authentication required", ErrorCodes.AUTH, 401)
    payload = decode_token(credentials.credentials, "access")
    email = payload.get("sub")
    if not email:
        raise AppException("Invalid token", ErrorCodes.AUTH, 401)
    user = db.query(User).filter(User.email == email).first()
    if not user or not user.is_active:
        raise AppException("User not found or inactive", ErrorCodes.AUTH, 401)
    return user


def get_optional_user(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(security)],
    db: Annotated[Session, Depends(get_db)],
) -> User | None:
    if not credentials:
        return None
    try:
        return get_current_user(credentials, db)
    except AppException:
        return None


def require_role(*roles: UserRole):
    def dependency(user: Annotated[User, Depends(get_current_user)]) -> User:
        if user.role not in roles:
            raise AppException("Insufficient permissions", ErrorCodes.FORBIDDEN, 403)
        return user

    return dependency
