from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import require_role
from app.models import User, UserRole
from app.schemas import PaymentInitiateResponse, PaymentStatusResponse
from app.services.payment_service import (
    confirm_payment,
    generate_qr_base64,
    get_payment_status,
    initiate_payment,
)
from app.services.settings_service import get_payment_settings

router = APIRouter(prefix="/payments", tags=["payments"])


@router.post("/{booking_id}/initiate", response_model=PaymentInitiateResponse)
def initiate(booking_id: int, db: Annotated[Session, Depends(get_db)]):
    payment = initiate_payment(db, booking_id)
    upi_id, _ = get_payment_settings(db)
    qr = generate_qr_base64(payment.upi_link or "")
    return PaymentInitiateResponse(
        payment_id=payment.id,
        amount=payment.amount,
        upi_link=payment.upi_link or "",
        upi_id=upi_id,
        qr_base64=qr,
        status=payment.status,
    )


@router.get("/{payment_id}/status", response_model=PaymentStatusResponse)
def status(payment_id: int, db: Annotated[Session, Depends(get_db)]):
    payment = get_payment_status(db, payment_id)
    return PaymentStatusResponse(
        payment_id=payment.id,
        status=payment.status,
        paid_at=payment.paid_at,
    )


@router.post("/{payment_id}/confirm", response_model=PaymentStatusResponse)
def confirm(
    payment_id: int,
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[User, Depends(require_role(UserRole.admin, UserRole.receptionist))],
):
    payment = confirm_payment(db, payment_id, user.id)
    return PaymentStatusResponse(
        payment_id=payment.id,
        status=payment.status,
        paid_at=payment.paid_at,
    )
