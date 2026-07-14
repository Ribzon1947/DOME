from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.models import Setting

settings = get_settings()


def get_setting(db: Session, key: str, default: str | None = None) -> str | None:
    db.expire_all()
    row = db.query(Setting).filter(Setting.key == key).first()
    if row and row.value.strip():
        return row.value.strip()
    env_map = {
        "upi_id": settings.upi_id,
        "upi_payee_name": settings.upi_payee_name,
    }
    return env_map.get(key, default)


def get_payment_settings(db: Session) -> tuple[str, str]:
    upi_id = get_setting(db, "upi_id", settings.upi_id) or settings.upi_id
    payee = get_setting(db, "upi_payee_name", settings.upi_payee_name) or settings.upi_payee_name
    return upi_id, payee


def get_all_settings(db: Session) -> dict[str, str]:
    db.expire_all()
    rows = {row.key: row.value for row in db.query(Setting).all()}
    return {
        "upi_id": rows.get("upi_id") or settings.upi_id,
        "upi_payee_name": rows.get("upi_payee_name") or settings.upi_payee_name,
    }
