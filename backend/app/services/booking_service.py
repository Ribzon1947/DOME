from datetime import datetime, timedelta, timezone

from sqlalchemy.orm import Session, joinedload

from app.core.config import get_settings
from app.core.errors import AppException, ErrorCodes
from app.models import Booking, BookingStatus, Room, RoomStatus
from app.services.pricing_service import calculate_booking_amount


def refresh_overstay_status(db: Session, booking: Booking) -> Booking:
    now = datetime.now(timezone.utc)
    checkout = booking.check_out
    if checkout.tzinfo is None:
        checkout = checkout.replace(tzinfo=timezone.utc)
    if booking.status == BookingStatus.checked_in and now > checkout:
        booking.status = BookingStatus.overstay
        from app.services.firebase_service import send_to_staff
        from app.services.notification_service import notify_overstay
        send_to_staff(
           db,
           title="Overstay alert",
           body=f"Room {booking.room.number} — {booking.customer_name}",
           data={"event": "overstay", "booking_id": booking.id, "room_id": booking.room_id},
        )
        notify_overstay(booking)


        db.commit()
        db.refresh(booking)
    return booking


def list_bookings(
    db: Session,
    status: BookingStatus | None = None,
    search: str | None = None,
    sort: str = "check_in",
) -> list[Booking]:
    query = db.query(Booking).options(
        joinedload(Booking.room).joinedload(Room.room_type),
        joinedload(Booking.payment),
        joinedload(Booking.id_document),
    )
    if status:
        query = query.filter(Booking.status == status)
    if search:
        term = f"%{search}%"
        query = query.join(Room).filter(
            (Booking.customer_name.ilike(term)) | (Room.number.ilike(term))
        )
    sort_col = getattr(Booking, sort, Booking.check_in)
    return query.order_by(sort_col.desc()).all()


def get_booking(db: Session, booking_id: int) -> Booking:
    booking = (
        db.query(Booking)
        .options(
            joinedload(Booking.room).joinedload(Room.room_type),
            joinedload(Booking.payment),
            joinedload(Booking.id_document),
        )
        .filter(Booking.id == booking_id)
        .first()
    )
    if not booking:
        raise AppException("Booking not found", ErrorCodes.NOT_FOUND, 404)
    return refresh_overstay_status(db, booking)


def create_booking(db: Session, data: dict, user_id: int | None = None) -> Booking:
    room = db.query(Room).filter(Room.id == data["room_id"]).first()
    if not room:
        raise AppException("Room not found", ErrorCodes.NOT_FOUND, 404)
    if room.status == RoomStatus.maintenance:
        raise AppException("Room is under maintenance", ErrorCodes.VALIDATION, 400)

    if data["check_out"] <= data["check_in"]:
        raise AppException("Check-out must be after check-in", ErrorCodes.VALIDATION, 400)

    overlap = db.query(Booking).filter(
        Booking.room_id == data["room_id"],
        Booking.status.in_([BookingStatus.pending, BookingStatus.checked_in, BookingStatus.overstay]),
        Booking.check_in < data["check_out"],
        Booking.check_out > data["check_in"],
    ).first()
    if overlap:
        raise AppException("Room is not available for the selected dates", ErrorCodes.VALIDATION, 400)

    amount = calculate_booking_amount(db, room.room_type_id, data["check_in"], data["check_out"])
    booking = Booking(
        room_id=data["room_id"],
        created_by=user_id,
        customer_name=data["customer_name"],
        customer_email=data.get("customer_email"),
        customer_phone=data.get("customer_phone"),
        dob=data.get("dob"),
        id_number=data.get("id_number"),
        check_in=data["check_in"],
        check_out=data["check_out"],
        amount=amount,
        notes=data.get("notes"),
        status=BookingStatus.pending,
    )
    db.add(booking)
    db.flush()

    document_id = data.get("document_id")
    if document_id:
        from app.models import IdDocument

        doc = db.query(IdDocument).filter(IdDocument.id == document_id).first()
        if doc:
            doc.booking_id = booking.id

    from app.services.firebase_service import send_to_staff
    from app.services.notification_service import notify_new_booking
    send_to_staff(
        db,
        title="New booking",
        body=f"Room {booking.room.number} — {booking.customer_name}",
        data={"event": "booking_created", "booking_id": booking.id, "room_id": booking.room_id},
    )
    notify_new_booking(booking)

    db.commit()
    db.refresh(booking)
    return get_booking(db, booking.id)




def update_booking(db: Session, booking_id: int, data: dict) -> Booking:
    booking = get_booking(db, booking_id)
    for key, value in data.items():
        if value is not None and hasattr(booking, key):
            setattr(booking, key, value)
    if "check_in" in data or "check_out" in data or "room_id" in data:
        room_id = data.get("room_id", booking.room_id)
        room = db.query(Room).filter(Room.id == room_id).first()
        if room:
            booking.amount = calculate_booking_amount(
                db, room.room_type_id, booking.check_in, booking.check_out
            )
    db.commit()
    return get_booking(db, booking_id)


def check_in_booking(db: Session, booking_id: int) -> Booking:
    from app.services.notification_service import notify_checkin_failed, notify_checkin_success
    try:
        booking = get_booking(db, booking_id)
        booking.status = BookingStatus.checked_in
        room = db.query(Room).filter(Room.id == booking.room_id).first()
        if room:
            room.status = RoomStatus.occupied
        db.commit()
        result = get_booking(db, booking_id)
        notify_checkin_success(result.customer_name, result.room.number, booking_id)
        return result
    except Exception as exc:
        reason = exc.message if isinstance(exc, AppException) else str(exc)
        notify_checkin_failed(booking_id, reason)
        raise


def check_out_booking(db: Session, booking_id: int) -> Booking:
    from app.models import IdDocument
    from app.services.mqtt_service import publish_room_lock

    booking = get_booking(db, booking_id)
    booking.status = BookingStatus.checked_out
    room = db.query(Room).filter(Room.id == booking.room_id).first()
    if room:
        room.status = RoomStatus.available

    purge_days = get_settings().id_purge_days
    doc = db.query(IdDocument).filter(IdDocument.booking_id == booking_id).first()
    if doc:
        doc.purge_after = datetime.now(timezone.utc) + timedelta(days=purge_days)

    db.commit()

    if room:
        publish_room_lock(room.number, booking_id)

    return get_booking(db, booking_id)


def get_calendar(db: Session, start: datetime, end: datetime) -> dict:
    rooms = db.query(Room).order_by(Room.number).all()
    bookings = (
        db.query(Booking)
        .filter(Booking.check_in <= end, Booking.check_out >= start)
        .filter(Booking.status.notin_([BookingStatus.expired]))
        .all()
    )

    rows = []
    current = start
    dates = []
    while current <= end:
        dates.append(current.date().isoformat())
        current = current.replace(hour=0, minute=0, second=0) + timedelta(days=1)

    for room in rooms:
        cells = []
        for date_str in dates:
            cell_date = datetime.fromisoformat(date_str).replace(tzinfo=timezone.utc)
            match = None
            for b in bookings:
                if b.room_id != room.id:
                    continue
                ci = b.check_in.replace(tzinfo=timezone.utc) if b.check_in.tzinfo is None else b.check_in
                co = b.check_out.replace(tzinfo=timezone.utc) if b.check_out.tzinfo is None else b.check_out
                if ci.date() <= cell_date.date() <= co.date():
                    match = b
                    break
            cells.append(
                {
                    "date": date_str,
                    "booking_id": match.id if match else None,
                    "status": match.status.value if match else None,
                    "customer_name": match.customer_name if match else None,
                }
            )
        rows.append({"room_id": room.id, "room_number": room.number, "cells": cells})

    return {
        "start_date": start.date().isoformat(),
        "end_date": end.date().isoformat(),
        "rows": rows,
    }
