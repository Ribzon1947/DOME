import json
import logging
import urllib.request
from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.models import Booking, BookingStatus, IdDocument

logger = logging.getLogger(__name__)
settings = get_settings()

AISENSY_URL = "https://backend.aisensy.com/campaign/t1/api/v2"
MSG91_FLOW_URL = "https://api.msg91.com/api/v5/flow/"


# ── Helpers ───────────────────────────────────────────────────────────────────

def _normalize_phone(mobile: str) -> str:
    phone = mobile.lstrip("+").lstrip("0")
    if not phone.startswith("91"):
        phone = "91" + phone
    return phone


def _post_json(url: str, payload: dict, headers: dict, label: str) -> bool:
    req = urllib.request.Request(
        url,
        data=json.dumps(payload).encode(),
        headers={"Content-Type": "application/json", **headers},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=6) as resp:
            body = json.loads(resp.read())
            logger.info("%s response: %s", label, body)
            return True
    except Exception:
        logger.exception("%s request failed", label)
        return False


# ── AiSensy WhatsApp ──────────────────────────────────────────────────────────

def send_aisensy(campaign: str, destination: str, template_params: list[str]) -> bool:
    """Send a WhatsApp message via AiSensy Campaign API."""
    if not settings.aisensy_api_key or not campaign:
        logger.info("AiSensy not configured, skipping WhatsApp to %s", destination)
        return False

    return _post_json(
        AISENSY_URL,
        {
            "apiKey": settings.aisensy_api_key,
            "campaignName": campaign,
            "destination": _normalize_phone(destination),
            "userName": settings.aisensy_user_name,
            "templateParams": template_params,
            "source": "dome-backend",
            "media": {},
            "buttons": [],
            "carouselCards": [],
            "location": {},
        },
        headers={},
        label=f"AiSensy[{campaign}]",
    )


# ── MSG91 SMS ─────────────────────────────────────────────────────────────────

def send_msg91_flow(flow_id: str, mobile: str, variables: dict) -> bool:
    """Send a message via MSG91 Flow (Campaign) API."""
    if not settings.msg91_auth_key or not flow_id:
        logger.info("MSG91 not configured, skipping SMS to %s", mobile)
        return False

    return _post_json(
        MSG91_FLOW_URL,
        {"flow_id": flow_id, "sender": settings.msg91_sender_id, "mobiles": _normalize_phone(mobile), **variables},
        headers={"authkey": settings.msg91_auth_key},
        label=f"MSG91[{flow_id}]",
    )


# ── Email ─────────────────────────────────────────────────────────────────────

async def send_email(to: str, subject: str, body: str) -> bool:
    if not settings.smtp_host:
        logger.info("SMTP not configured, skipping email to %s", to)
        return False
    try:
        import aiosmtplib
        from email.message import EmailMessage

        msg = EmailMessage()
        msg["From"] = settings.smtp_from
        msg["To"] = to
        msg["Subject"] = subject
        msg.set_content(body)

        await aiosmtplib.send(
            msg,
            hostname=settings.smtp_host,
            port=settings.smtp_port,
            username=settings.smtp_user or None,
            password=settings.smtp_password or None,
            start_tls=True,
        )
        return True
    except Exception:
        logger.exception("Failed to send email to %s", to)
        return False


# ── Booking events ────────────────────────────────────────────────────────────

def notify_new_booking(booking: Booking) -> None:
    """WhatsApp alert to admin when a new booking is created."""
    send_aisensy(
        settings.aisensy_campaign_new_booking,
        settings.aisensy_admin_phone,
        [
            booking.customer_name,
            booking.room.number,
            booking.check_in.strftime("%d %b %Y"),
            booking.check_out.strftime("%d %b %Y"),
        ],
    )


def notify_checkin_success(customer_name: str, room_number: str, booking_id: int) -> None:
    """WhatsApp to admin + SMS to admin on successful check-in."""
    send_aisensy(
        settings.aisensy_campaign_checkin,
        settings.aisensy_admin_phone,
        [customer_name, room_number, str(booking_id)],
    )
    send_msg91_flow(
        settings.msg91_checkin_success_flow,
        settings.msg91_admin_phone,
        {"VAR1": customer_name, "VAR2": room_number, "VAR3": str(booking_id)},
    )


def notify_checkin_failed(booking_id: int, reason: str) -> None:
    """WhatsApp to admin + SMS to admin on failed check-in."""
    send_aisensy(
        settings.aisensy_campaign_checkin,
        settings.aisensy_admin_phone,
        [str(booking_id), reason[:100]],
    )
    send_msg91_flow(
        settings.msg91_checkin_failed_flow,
        settings.msg91_admin_phone,
        {"VAR1": str(booking_id), "VAR2": reason[:100]},
    )


def notify_overstay(booking: Booking) -> None:
    """WhatsApp alert to admin when a guest is in overstay."""
    send_aisensy(
        settings.aisensy_campaign_overstay,
        settings.aisensy_admin_phone,
        [booking.customer_name, booking.room.number],
    )


async def notify_checkout_reminder(booking: Booking) -> None:
    """WhatsApp + email to guest before checkout."""
    subject = f"Checkout reminder - Room {booking.room.number}"
    body = (
        f"Dear {booking.customer_name},\n\n"
        f"Your checkout is scheduled at {booking.check_out.strftime('%Y-%m-%d %H:%M')}.\n"
        f"Please visit reception to complete checkout.\n"
    )
    if booking.customer_email:
        await send_email(booking.customer_email, subject, body)
    if booking.customer_phone:
        send_aisensy(
            settings.aisensy_campaign_checkout_reminder,
            booking.customer_phone,
            [
                booking.customer_name,
                booking.check_out.strftime("%d %b %Y, %I:%M %p"),
                booking.room.number,
            ],
        )


async def notify_payment_receipt(booking: Booking, amount: str) -> None:
    """WhatsApp + email to guest after payment confirmed."""
    subject = "Payment receipt"
    body = f"Thank you {booking.customer_name}. Payment of INR {amount} received for booking #{booking.id}."
    if booking.customer_email:
        await send_email(booking.customer_email, subject, body)
    if booking.customer_phone:
        send_aisensy(
            settings.aisensy_campaign_payment,
            booking.customer_phone,
            [booking.customer_name, amount, str(booking.id)],
        )
