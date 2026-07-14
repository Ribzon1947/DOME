import base64
import io
import json
import logging
from datetime import datetime, timezone
from decimal import Decimal

import qrcode
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.errors import AppException, ErrorCodes
from app.models import Payment, PaymentStatus, TransactionLog
from app.services.booking_service import get_booking
from app.services.settings_service import get_payment_settings

logger = logging.getLogger(__name__)
settings = get_settings()


def build_upi_link(amount: Decimal, booking_id: int, db: Session) -> str:
    upi_id, payee = get_payment_settings(db)
    return (
        f"upi://pay?pa={upi_id}"
        f"&pn={payee.replace(' ', '%20')}"
        f"&am={amount}"
        f"&cu=INR"
        f"&tn=Booking-{booking_id}"
    )


def generate_qr_base64(data: str) -> str:
    img = qrcode.make(data)
    buffer = io.BytesIO()
    img.save(buffer, format="PNG")
    return base64.b64encode(buffer.getvalue()).decode("utf-8")


def initiate_payment(db: Session, booking_id: int) -> Payment:
    booking = get_booking(db, booking_id)
    upi_link = build_upi_link(booking.amount, booking_id, db)

    payment = db.query(Payment).filter(Payment.booking_id == booking_id).first()
    if payment:
        if payment.status == PaymentStatus.paid:
            raise AppException("Booking already paid", ErrorCodes.PAYMENT_ERROR, 400)
        payment.amount = booking.amount
        payment.upi_link = upi_link
        payment.status = PaymentStatus.pending
    else:
        payment = Payment(
            booking_id=booking_id,
            amount=booking.amount,
            upi_link=upi_link,
            status=PaymentStatus.pending,
        )
        db.add(payment)
        try:
            db.flush()
        except IntegrityError:
            db.rollback()
            payment = db.query(Payment).filter(Payment.booking_id == booking_id).first()
            if not payment:
                logger.exception("Payment insert race for booking %s", booking_id)
                raise AppException("Could not start payment. Please try again.", ErrorCodes.PAYMENT_ERROR, 500)
            if payment.status == PaymentStatus.paid:
                raise AppException("Booking already paid", ErrorCodes.PAYMENT_ERROR, 400)
            payment.amount = booking.amount
            payment.upi_link = upi_link
            payment.status = PaymentStatus.pending

    db.commit()
    db.refresh(payment)
    return payment


def get_payment_status(db: Session, payment_id: int) -> Payment:
    payment = db.query(Payment).filter(Payment.id == payment_id).first()
    if not payment:
        raise AppException("Payment not found", ErrorCodes.NOT_FOUND, 404)
    return payment


def confirm_payment(db: Session, payment_id: int, user_id: int) -> Payment:
    payment = get_payment_status(db, payment_id)
    if payment.status == PaymentStatus.paid:
        raise AppException("Payment already confirmed", ErrorCodes.PAYMENT_ERROR, 400)

    payment.status = PaymentStatus.paid
    payment.paid_at = datetime.now(timezone.utc)
    payment.confirmed_by = user_id

    log = TransactionLog(
        payment_id=payment.id,
        action="payment_confirmed",
        amount=payment.amount,
        metadata_json=json.dumps({"confirmed_by": user_id, "method": "upi_manual"}),
    )
    db.add(log)
    db.commit()
    db.refresh(payment)

    from app.services.firebase_service import send_to_staff
    send_to_staff(
        db,
        title="Payment received",
        body=f"₹{payment.amount} — Booking #{payment.booking_id}",
        data={"event": "payment_confirmed", "payment_id": str(payment.id), "booking_id": str(payment.booking_id)},
    )

    booking = get_booking(db, payment.booking_id)
    if booking.room:
        from app.services import mqtt_service
        mqtt_service.publish_room_unlock(booking.room.number, booking.id)

    return payment
