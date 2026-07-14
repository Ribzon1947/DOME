import asyncio
import logging
from datetime import datetime, timedelta, timezone

from sqlalchemy.orm import joinedload

from app.core.config import get_settings
from app.core.database import SessionLocal
from app.models import Booking, BookingStatus, PaymentStatus
from app.services.notification_service import notify_checkout_reminder
from app.tasks.celery_app import celery_app

logger = logging.getLogger(__name__)
settings = get_settings()


@celery_app.task(name="app.tasks.notifications.send_checkout_reminders")
def send_checkout_reminders():
    db = SessionLocal()
    try:
        now = datetime.now(timezone.utc)
        window_start = now + timedelta(minutes=55)
        window_end = now + timedelta(minutes=65)
        bookings = (
            db.query(Booking)
            .options(joinedload(Booking.room))
            .filter(
                Booking.status.in_([BookingStatus.checked_in, BookingStatus.overstay]),
                Booking.check_out >= window_start,
                Booking.check_out <= window_end,
            )
            .all()
        )
        for booking in bookings:
            asyncio.run(notify_checkout_reminder(booking))
        logger.info("Sent %d checkout reminders", len(bookings))
    finally:
        db.close()


@celery_app.task(name="app.tasks.notifications.expire_pending_bookings")
def expire_pending_bookings():
    db = SessionLocal()
    try:
        cutoff = datetime.now(timezone.utc) - timedelta(minutes=settings.booking_hold_minutes)
        bookings = (
            db.query(Booking)
            .filter(Booking.status == BookingStatus.pending, Booking.created_at <= cutoff)
            .all()
        )
        for booking in bookings:
            if not booking.payment or booking.payment.status != PaymentStatus.paid:
                booking.status = BookingStatus.expired
        db.commit()
        logger.info("Expired %d pending bookings", len(bookings))
    finally:
        db.close()
