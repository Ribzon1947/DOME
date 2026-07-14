"""Firebase Cloud Messaging — initialise + send."""
import logging
import os
from pathlib import Path
from typing import Iterable

import firebase_admin
from firebase_admin import credentials, messaging
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.models import FcmToken, User, UserRole

logger = logging.getLogger(__name__)
settings = get_settings()

_initialized = False


def _resolve_credentials_path() -> str | None:
    raw = settings.firebase_credentials_path
    if not raw:
        return None
    p = Path(raw)
    if not p.is_absolute():
        backend_dir = Path(__file__).resolve().parent.parent.parent
        p = (backend_dir / raw).resolve()
    return str(p) if p.exists() else None


def initialise_firebase() -> bool:
    """Initialise Firebase Admin SDK. Safe to call multiple times."""
    global _initialized
    if _initialized:
        return True

    cred_path = _resolve_credentials_path()
    if not cred_path:
        logger.warning("Firebase credentials not configured — FCM disabled")
        return False

    try:
        cred = credentials.Certificate(cred_path)
        firebase_admin.initialize_app(cred, {"projectId": settings.firebase_project_id})
        _initialized = True
        logger.info("Firebase Admin SDK initialised")
        return True
    except Exception as exc:
        logger.warning("Firebase init failed: %s", exc)
        return False


def _send_to_tokens(tokens: list[str], title: str, body: str, data: dict | None = None) -> dict:
    """Send a single notification to multiple tokens. Returns success/failure counts."""
    if not tokens:
        return {"success": 0, "failure": 0}
    if not initialise_firebase():
        return {"success": 0, "failure": len(tokens), "error": "firebase_not_initialised"}

    message = messaging.MulticastMessage(
        notification=messaging.Notification(title=title, body=body),
        data={k: str(v) for k, v in (data or {}).items()},
        tokens=tokens,
    )
    try:
        response = messaging.send_each_for_multicast(message)
        return {"success": response.success_count, "failure": response.failure_count}
    except Exception as exc:
        logger.exception("FCM send failed: %s", exc)
        return {"success": 0, "failure": len(tokens), "error": str(exc)}


def send_to_role(db: Session, role: UserRole, title: str, body: str, data: dict | None = None) -> dict:
    """Send a notification to every active token belonging to users with the given role."""
    tokens = (
        db.query(FcmToken.token)
        .join(User, FcmToken.user_id == User.id)
        .filter(User.role == role, User.is_active.is_(True))
        .all()
    )
    token_list = [t[0] for t in tokens]
    return _send_to_tokens(token_list, title, body, data)


def send_to_staff(db: Session, title: str, body: str, data: dict | None = None) -> dict:
    """Notify both admins and receptionists."""
    tokens = (
        db.query(FcmToken.token)
        .join(User, FcmToken.user_id == User.id)
        .filter(User.role.in_([UserRole.admin, UserRole.receptionist]), User.is_active.is_(True))
        .all()
    )
    token_list = [t[0] for t in tokens]
    return _send_to_tokens(token_list, title, body, data)