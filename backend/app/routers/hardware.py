from typing import Annotated

from fastapi import APIRouter, Depends, File, Form, UploadFile
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.schemas import OcrResult
from app.services.booking_service import get_booking
from app.services.ocr_service import check_tesseract_available, process_id_scan

router = APIRouter(prefix="/hardware", tags=["hardware"])


@router.get("/health")
def hardware_health():
    return {
        "tesseract_available": check_tesseract_available(),
        "camera_supported": True,
    }


@router.post("/ocr/id-scan", response_model=OcrResult)
async def id_scan(
    db: Annotated[Session, Depends(get_db)],
    file: UploadFile = File(...),
    booking_id: int | None = Form(default=None),
):
    content = await file.read()
    doc = process_id_scan(db, content, booking_id=booking_id)
    return OcrResult(
        document_id=doc.id,
        extracted_name=doc.extracted_name,
        extracted_dob=doc.extracted_dob,
        extracted_id_number=doc.extracted_id_number,
    )


@router.get("/printer/receipt/{booking_id}")
def receipt_stub(booking_id: int, db: Annotated[Session, Depends(get_db)]):
    booking = get_booking(db, booking_id)
    return {
        "status": "stub",
        "message": "Connect local thermal printer bridge to consume this payload",
        "escpos_payload": {
            "lines": [
                "=== HOTEL RECEIPT ===",
                f"Booking: #{booking.id}",
                f"Guest: {booking.customer_name}",
                f"Room: {booking.room.number if booking.room else 'N/A'}",
                f"Amount: INR {booking.amount}",
                f"Check-in: {booking.check_in.isoformat()}",
                f"Check-out: {booking.check_out.isoformat()}",
                "Thank you!",
            ],
        },
    }
