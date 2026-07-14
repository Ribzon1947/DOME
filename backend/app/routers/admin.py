from typing import Annotated

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.database import get_db
from app.core.errors import AppException, ErrorCodes
from app.core.security import hash_password, require_role
from app.models import Booking, BookingStatus, PricingRule, Room, RoomType, Setting, TransactionLog, User, UserRole
from app.schemas import (
    PricingRuleCreate,
    PricingRuleResponse,
    RoomCreate,
    RoomResponse,
    RoomTypeResponse,
    RoomTypeUpdate,
    RoomUpdate,
    SettingResponse,
    SettingUpdate,
    TransactionLogResponse,
    UserCreate,
    UserResponse,
)
from app.services.purge_service import purge_expired_documents
from app.services.settings_service import get_all_settings

router = APIRouter(prefix="/admin", tags=["admin"])
settings = get_settings()


@router.get("/rooms", response_model=list[RoomResponse])
def list_rooms(
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[User, Depends(require_role(UserRole.admin, UserRole.receptionist))],
):
    return db.query(Room).order_by(Room.floor, Room.number).all()


@router.post("/rooms", response_model=RoomResponse, status_code=201)
def create_room(
    body: RoomCreate,
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[User, Depends(require_role(UserRole.admin))],
):
    if db.query(Room).filter(Room.number == body.number).first():
        raise AppException("Room number already exists", ErrorCodes.VALIDATION, 400)
    room = Room(**body.model_dump())
    db.add(room)
    db.commit()
    db.refresh(room)
    return room


@router.patch("/rooms/{room_id}", response_model=RoomResponse)
def update_room(
    room_id: int,
    body: RoomUpdate,
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[User, Depends(require_role(UserRole.admin))],
):
    room = db.query(Room).filter(Room.id == room_id).first()
    if not room:
        raise AppException("Room not found", ErrorCodes.NOT_FOUND, 404)
    updates = body.model_dump(exclude_none=True)
    if "number" in updates and updates["number"] != room.number:
        if db.query(Room).filter(Room.number == updates["number"]).first():
            raise AppException("Room number already exists", ErrorCodes.VALIDATION, 400)
    for k, v in updates.items():
        setattr(room, k, v)
    db.commit()
    db.refresh(room)
    return room


@router.delete("/rooms/{room_id}", status_code=204)
def delete_room(
    room_id: int,
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[User, Depends(require_role(UserRole.admin))],
):
    room = db.query(Room).filter(Room.id == room_id).first()
    if not room:
        raise AppException("Room not found", ErrorCodes.NOT_FOUND, 404)
    active = db.query(Booking).filter(
        Booking.room_id == room_id,
        Booking.status.in_([BookingStatus.pending, BookingStatus.checked_in]),
    ).first()
    if active:
        raise AppException("Cannot delete room with active bookings", ErrorCodes.VALIDATION, 400)
    db.delete(room)
    db.commit()


@router.get("/room-types", response_model=list[RoomTypeResponse])
def list_room_types(
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[User, Depends(require_role(UserRole.admin, UserRole.receptionist))],
):
    return db.query(RoomType).all()


@router.patch("/room-types/{room_type_id}", response_model=RoomTypeResponse)
def update_room_type(
    room_type_id: int,
    body: RoomTypeUpdate,
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[User, Depends(require_role(UserRole.admin))],
):
    room_type = db.query(RoomType).filter(RoomType.id == room_type_id).first()
    if not room_type:
        raise AppException("Room type not found", ErrorCodes.NOT_FOUND, 404)
    for k, v in body.model_dump(exclude_none=True).items():
        setattr(room_type, k, v)
    db.commit()
    db.refresh(room_type)
    return room_type


@router.get("/pricing", response_model=list[PricingRuleResponse])
def list_pricing(
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[User, Depends(require_role(UserRole.admin))],
):
    return db.query(PricingRule).all()


@router.post("/pricing", response_model=PricingRuleResponse)
def create_pricing(
    body: PricingRuleCreate,
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[User, Depends(require_role(UserRole.admin))],
):
    rule = PricingRule(**body.model_dump())
    db.add(rule)
    db.commit()
    db.refresh(rule)
    return rule


@router.patch("/pricing/{rule_id}", response_model=PricingRuleResponse)
def update_pricing(
    rule_id: int,
    body: PricingRuleCreate,
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[User, Depends(require_role(UserRole.admin))],
):
    rule = db.query(PricingRule).filter(PricingRule.id == rule_id).first()
    if not rule:
        raise AppException("Pricing rule not found", ErrorCodes.NOT_FOUND, 404)
    for k, v in body.model_dump().items():
        setattr(rule, k, v)
    db.commit()
    db.refresh(rule)
    return rule


@router.delete("/pricing/{rule_id}", status_code=204)
def delete_pricing(
    rule_id: int,
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[User, Depends(require_role(UserRole.admin))],
):
    rule = db.query(PricingRule).filter(PricingRule.id == rule_id).first()
    if not rule:
        raise AppException("Pricing rule not found", ErrorCodes.NOT_FOUND, 404)
    db.delete(rule)
    db.commit()


@router.get("/settings", response_model=list[SettingResponse])
def get_settings_list(
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[User, Depends(require_role(UserRole.admin))],
):
    merged = get_all_settings(db)
    return [SettingResponse(key=k, value=v) for k, v in merged.items()]


@router.put("/settings", response_model=SettingResponse)
def upsert_setting(
    body: SettingUpdate,
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[User, Depends(require_role(UserRole.admin))],
):
    row = db.query(Setting).filter(Setting.key == body.key).first()
    if row:
        row.value = body.value
    else:
        row = Setting(key=body.key, value=body.value)
        db.add(row)
    db.commit()
    db.refresh(row)
    return SettingResponse(key=row.key, value=row.value)


@router.get("/staff", response_model=list[UserResponse])
def list_staff(
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[User, Depends(require_role(UserRole.admin))],
):
    return db.query(User).all()


@router.post("/staff", response_model=UserResponse)
def create_staff(
    body: UserCreate,
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[User, Depends(require_role(UserRole.admin))],
):
    if db.query(User).filter(User.email == body.email).first():
        raise AppException("Email already registered", ErrorCodes.VALIDATION, 400)
    user = User(
        email=body.email,
        full_name=body.full_name,
        password_hash=hash_password(body.password),
        role=body.role,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@router.get("/transactions", response_model=list[TransactionLogResponse])
def list_transactions(
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[User, Depends(require_role(UserRole.admin))],
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
):
    return (
        db.query(TransactionLog)
        .order_by(TransactionLog.created_at.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )


@router.post("/purge-id-documents")
def manual_purge(
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[User, Depends(require_role(UserRole.admin))],
):
    count = purge_expired_documents(db)
    return {"purged": count}
