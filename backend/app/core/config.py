from functools import lru_cache
from pathlib import Path

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

BASE_DIR = Path(__file__).resolve().parent.parent.parent


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=str(BASE_DIR / ".env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    database_url: str = f"sqlite:///{BASE_DIR / 'data' / 'room_kiosk.db'}"
    secret_key: str = "dev-secret-key-change-in-production"
    access_token_expire_minutes: int = 15
    refresh_token_expire_days: int = 7
    redis_url: str = "redis://localhost:6379/0"
    cors_origins: str = "http://localhost:5173"
    upi_id: str = "hotel@upi"
    upi_payee_name: str = "Hotel Reception"
    storage_path: str = str(BASE_DIR / "storage")
    smtp_host: str = ""
    smtp_port: int = 587
    smtp_user: str = ""
    smtp_password: str = ""
    smtp_from: str = "noreply@hotel.local"
    whatsapp_api_key: str = ""
    whatsapp_api_url: str = ""
    kiosk_inactivity_seconds: int = 60
    booking_hold_minutes: int = 30
    id_purge_days: int = 30
    google_application_credentials: str = ""
    firebase_credentials_path: str = ""
    firebase_project_id: str = ""
    mqtt_host: str = ""
    mqtt_port: int = 8883
    mqtt_username: str = ""
    mqtt_password: str = ""
    mqtt_tls: bool = True
    mqtt_topic_prefix: str = "dome/room"
    room_unlock_minutes: int = 120
    msg91_auth_key: str = ""
    msg91_checkin_success_flow: str = ""
    msg91_checkin_failed_flow: str = ""
    msg91_sender_id: str = "HOTEL"
    msg91_admin_phone: str = "918966051698"
    aisensy_api_key: str = ""
    aisensy_user_name: str = "Hotel Reception"
    aisensy_campaign_checkin: str = ""
    aisensy_campaign_checkout_reminder: str = ""
    aisensy_campaign_payment: str = ""
    aisensy_campaign_new_booking: str = ""
    aisensy_campaign_overstay: str = ""
    aisensy_admin_phone: str = "918966051698"

    @field_validator("database_url", mode="after")
    @classmethod
    def resolve_sqlite_path(cls, value: str) -> str:
        if value.startswith("sqlite:///./") or value.startswith("sqlite:///data/"):
            db_path = BASE_DIR / value.split("sqlite:///")[-1].lstrip("./")
            db_path.parent.mkdir(parents=True, exist_ok=True)
            return f"sqlite:///{db_path.resolve()}"
        if value.startswith("sqlite:///") and not value.startswith("sqlite:////"):
            path_part = value.replace("sqlite:///", "")
            if not Path(path_part).is_absolute():
                db_path = (BASE_DIR / path_part).resolve()
                db_path.parent.mkdir(parents=True, exist_ok=True)
                return f"sqlite:///{db_path}"
        return value

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]



@lru_cache
def get_settings() -> Settings:
    return Settings()

import logging
logging.warning(f"DB path resolved to: {get_settings().database_url}")