from datetime import datetime, timedelta, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session, joinedload

from app.core.database import get_db
from app.core.security import get_current_user, get_optional_user, require_role
from app.models import Booking, BookingStatus, Room, RoomStatus, User, UserRole
from app.schemas import (
    BookingCreate,
    BookingResponse,
    BookingUpdate,
    CalendarResponse,
    RoomResponse,
)
from app.services.booking_service import (
    check_in_booking,
    check_out_booking,
    create_booking,
    get_booking,
    get_calendar,
    list_bookings,
    update_booking,
)

router = APIRouter(prefix="/bookings", tags=["bookings"])


@router.get("/rooms/available", response_model=list[RoomResponse])
def available_rooms(
    db: Annotated[Session, Depends(get_db)],
    check_in: datetime | None = None,
    check_out: datetime | None = None,
):
    query = (
        db.query(Room)
        .options(joinedload(Room.room_type))
        .filter(Room.status == RoomStatus.available)
    )
    if check_in and check_out:
        busy = (
            db.query(Booking.room_id)
            .filter(
                Booking.check_in < check_out,
                Booking.check_out > check_in,
                Booking.status.in_(
                    [BookingStatus.pending, BookingStatus.checked_in, BookingStatus.overstay]
                ),
            )
            .subquery()
        )
        query = query.filter(Room.id.not_in(busy))
    return query.order_by(Room.number).all()


@router.get("/public/{booking_id}", response_model=BookingResponse)
def get_public_booking(booking_id: int, db: Annotated[Session, Depends(get_db)]):
    return get_booking(db, booking_id)


@router.get("", response_model=list[BookingResponse])
def get_bookings(
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[User, Depends(get_current_user)],
    status: BookingStatus | None = None,
    search: str | None = None,
    sort: str = "check_in",
):
    return list_bookings(db, status=status, search=search, sort=sort)


@router.get("/calendar", response_model=CalendarResponse)
def calendar(
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[User, Depends(get_current_user)],
    start: datetime | None = None,
    days: int = Query(default=7, ge=1, le=31),
):
    start = start or datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    end = start + timedelta(days=days - 1)
    return get_calendar(db, start, end)


@router.post("", response_model=BookingResponse)
def create(
    body: BookingCreate,
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[User | None, Depends(get_optional_user)],
):
    return create_booking(db, body.model_dump(), user_id=user.id if user else None)


@router.get("/{booking_id}", response_model=BookingResponse)
def get_one(
    booking_id: int,
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[User, Depends(get_current_user)],
):
    return get_booking(db, booking_id)


@router.patch("/{booking_id}", response_model=BookingResponse)
def update(
    booking_id: int,
    body: BookingUpdate,
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[User, Depends(require_role(UserRole.admin, UserRole.receptionist))],
):
    return update_booking(db, booking_id, body.model_dump(exclude_unset=True))


@router.post("/{booking_id}/check-in", response_model=BookingResponse)
def check_in(
    booking_id: int,
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[User, Depends(require_role(UserRole.admin, UserRole.receptionist))],
):
    return check_in_booking(db, booking_id)


@router.post("/{booking_id}/check-out", response_model=BookingResponse)
def check_out(
    booking_id: int,
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[User, Depends(require_role(UserRole.admin, UserRole.receptionist))],
):
    return check_out_booking(db, booking_id)
