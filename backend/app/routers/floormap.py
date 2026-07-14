from typing import Annotated, Optional

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session, joinedload

from app.core.database import get_db
from app.core.errors import AppException, ErrorCodes
from app.core.security import require_role
from app.models import Booking, Room, User, UserRole

router = APIRouter(prefix="/floormap", tags=["floormap"])


class FloorMapRoomOut(BaseModel):
    id: int
    number: str
    status: Optional[str] = None
    room_type: str
    floor: int
    is_highlighted: bool


class FloorData(BaseModel):
    floor: int
    rooms: list[FloorMapRoomOut]


class FloorMapResponse(BaseModel):
    floors: list[FloorData]
    highlighted_room_number: Optional[str] = None
    highlighted_floor: Optional[int] = None


def _build_floor_map(
    rooms: list[Room],
    highlighted_room_id: Optional[int] = None,
    full_status: bool = True,
) -> FloorMapResponse:
    floor_dict: dict[int, list[FloorMapRoomOut]] = {}
    highlighted_number: Optional[str] = None
    highlighted_floor: Optional[int] = None

    for room in sorted(rooms, key=lambda r: r.number):
        floor = room.floor or 1
        is_highlighted = room.id == highlighted_room_id
        if is_highlighted:
            highlighted_number = room.number
            highlighted_floor = floor

        room_out = FloorMapRoomOut(
            id=room.id,
            number=room.number,
            status=room.status.value if (full_status or is_highlighted) else None,
            room_type=room.room_type.name if room.room_type else "Standard",
            floor=floor,
            is_highlighted=is_highlighted,
        )
        floor_dict.setdefault(floor, []).append(room_out)

    floors = [
        FloorData(floor=f, rooms=room_list)
        for f, room_list in sorted(floor_dict.items())
    ]
    return FloorMapResponse(
        floors=floors,
        highlighted_room_number=highlighted_number,
        highlighted_floor=highlighted_floor,
    )


@router.get("/admin", response_model=FloorMapResponse)
def admin_floormap(
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[User, Depends(require_role(UserRole.admin, UserRole.receptionist))],
):
    rooms = db.query(Room).options(joinedload(Room.room_type)).all()
    return _build_floor_map(rooms, full_status=True)


@router.get("/booking/{booking_id}", response_model=FloorMapResponse)
def booking_floormap(booking_id: int, db: Annotated[Session, Depends(get_db)]):
    booking = (
        db.query(Booking)
        .options(
            joinedload(Booking.room).joinedload(Room.room_type),
            joinedload(Booking.payment),
        )
        .filter(Booking.id == booking_id)
        .first()
    )
    if not booking:
        raise AppException("Booking not found", ErrorCodes.NOT_FOUND, 404)
    if not booking.payment or booking.payment.status.value != "paid":
        raise AppException("Payment not completed", ErrorCodes.AUTH, 403)

    rooms = db.query(Room).options(joinedload(Room.room_type)).all()
    return _build_floor_map(rooms, highlighted_room_id=booking.room_id, full_status=False)
