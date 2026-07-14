"""Endpoints for FCM token registration and unregistration."""
from typing import Annotated
from datetime import datetime, timezone

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user
from app.models import FcmToken, User

router = APIRouter(prefix="/notifications", tags=["notifications"])


class RegisterTokenRequest(BaseModel):
    token: str
    device_label: str | None = None


@router.post("/register")
def register_token(
    body: RegisterTokenRequest,
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
):
    """Frontend calls this after the staff member grants notification permission."""
    existing = db.query(FcmToken).filter(FcmToken.token == body.token).first()
    if existing:
        existing.user_id = user.id
        existing.device_label = body.device_label
        existing.last_used_at = datetime.now(timezone.utc)
    else:
        existing = FcmToken(
            user_id=user.id,
            token=body.token,
            device_label=body.device_label,
        )
        db.add(existing)
    db.commit()
    return {"status": "registered", "token_id": existing.id}


@router.delete("/register")
def unregister_token(
    token: str,
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
):
    """Frontend calls this on logout."""
    row = db.query(FcmToken).filter(
        FcmToken.token == token,
        FcmToken.user_id == user.id,
    ).first()
    if row:
        db.delete(row)
        db.commit()
    return {"status": "unregistered"}