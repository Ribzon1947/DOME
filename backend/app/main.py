from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from fastapi.exceptions import RequestValidationError

from app.core.config import get_settings
from app.core.database import Base, engine
from app.core.errors import (
    AppException,
    app_exception_handler,
    generic_exception_handler,
    validation_exception_handler,
)
from app.core.logging import setup_logging
from app.routers import admin, auth, bookings, floormap, hardware, notifications, payments

settings = get_settings()

from fastapi import FastAPI

app = FastAPI()

@app.get("/api/health")
def health():
    return {"status": "ok"}


def seed_initial_data():
    from decimal import Decimal

    from sqlalchemy.orm import Session

    from app.core.database import SessionLocal
    from app.core.security import hash_password
    from app.models import RoomType, User, UserRole

    db: Session = SessionLocal()
    try:
        if not db.query(User).filter(User.email == "admin@hotel.dev").first():
            db.add(
                User(
                    email="admin@hotel.dev",
                    full_name="System Admin",
                    password_hash=hash_password("admin123"),
                    role=UserRole.admin,
                )
            )
        if not db.query(User).filter(User.email == "reception@hotel.dev").first():
            db.add(
                User(
                    email="reception@hotel.dev",
                    full_name="Front Desk",
                    password_hash=hash_password("reception123"),
                    role=UserRole.receptionist,
                )
            )
        for name, price, desc in [
            ("Standard", "1500.00", "Standard room"),
            ("Deluxe", "2500.00", "Deluxe room"),
            ("Suite", "4000.00", "Suite room"),
            ("Family", "3000.00", "Family room"),
            ("Triple Bed", "2200.00", "Triple bed room"),
        ]:
            if not db.query(RoomType).filter(RoomType.name == name).first():
                db.add(RoomType(name=name, base_price=Decimal(price), description=desc))
        db.commit()
    finally:
        db.close()


@asynccontextmanager
async def lifespan(app: FastAPI):
    setup_logging()
    Base.metadata.create_all(bind=engine)
    seed_initial_data()
    from app.services import mqtt_service
    mqtt_service.connect()
    yield
    mqtt_service.disconnect()


app = FastAPI(title="Room Kiosk API", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.add_exception_handler(AppException, app_exception_handler)
app.add_exception_handler(RequestValidationError, validation_exception_handler)
app.add_exception_handler(Exception, generic_exception_handler)

app.include_router(auth.router, prefix="/api")
app.include_router(bookings.router, prefix="/api")
app.include_router(payments.router, prefix="/api")
app.include_router(hardware.router, prefix="/api")
app.include_router(admin.router, prefix="/api")
app.include_router(notifications.router, prefix="/api")
app.include_router(floormap.router, prefix="/api")


@app.get("/api/health")
def health():
    return {"status": "ok"}
