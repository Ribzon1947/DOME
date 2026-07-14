import io
import logging
import os
import re
import uuid
from pathlib import Path

from PIL import Image
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.errors import AppException, ErrorCodes
from app.models import IdDocument

logger = logging.getLogger(__name__)
settings = get_settings()

_SKIP_KEYWORDS = {
    "government", "india", "unique", "uidai", "authority",
    "male", "female", "dob", "year", "address",
}


def _looks_like_name(text: str) -> bool:
    """Return True if *text* could plausibly be a person's name."""
    if not text or len(text) < 3:
        return False
    words = text.split()
    if len(words) < 2 or len(words) > 5:
        return False
    lower = text.lower()
    if any(kw in lower for kw in _SKIP_KEYWORDS):
        return False
    if re.search(r"\d", text):
        return False
    if not all(re.match(r"^[A-Za-z]{2,}$", w) for w in words):
        return False
    return True


def _resolve_credentials_path() -> None:
    """Ensure GOOGLE_APPLICATION_CREDENTIALS points to an absolute path."""
    raw = settings.google_application_credentials or os.environ.get("GOOGLE_APPLICATION_CREDENTIALS", "")
    if not raw:
        return
    p = Path(raw)
    if not p.is_absolute():
        backend_dir = Path(__file__).resolve().parent.parent.parent
        p = (backend_dir / raw).resolve()
    os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = str(p)


def _parse_ocr_text(text: str) -> dict:
    name = None
    dob = None
    id_number = None

    aadhaar_match = re.search(r"\b(\d{4})[\s\-]?(\d{4})[\s\-]?(\d{4})\b", text)
    if aadhaar_match:
        id_number = aadhaar_match.group(1) + aadhaar_match.group(2) + aadhaar_match.group(3)

    dob_match = re.search(r"\b(\d{2}[/-]\d{2}[/-]\d{4})\b", text)
    if dob_match:
        dob = dob_match.group(1)

    lines = [ln.strip() for ln in text.splitlines() if ln.strip()]

    for i, line in enumerate(lines):
        if re.match(r"^(name|नाम)\b", line, re.IGNORECASE) and i + 1 < len(lines):
            candidate = lines[i + 1].strip()
            if _looks_like_name(candidate):
                name = candidate
                break
            
    for line in lines:
        lower = line.lower()
        if (
            len(line) > 3
            and not re.search(r"\d{4}", line)
            and not any(kw in lower for kw in _SKIP_KEYWORDS)
            and re.search(r"[A-Za-z]{3,}", line)
        ):
            name = line
            break

    return {
        "extracted_name": name,
        "extracted_dob": dob,
        "extracted_id_number": id_number,
    }


def _run_vision_ocr(image_bytes: bytes) -> str:
    """Send image to Cloud Vision; return the full detected text."""
    from google.cloud import vision

    _resolve_credentials_path()
    client = vision.ImageAnnotatorClient()
    image = vision.Image(content=image_bytes)
    response = client.text_detection(image=image)

    if response.error.message:
        raise RuntimeError(f"Vision API error: {response.error.message}")

    if response.full_text_annotation and response.full_text_annotation.text:
        return response.full_text_annotation.text
    return ""


def process_id_scan(
    db: Session,
    image_bytes: bytes,
    booking_id: int | None = None,
) -> IdDocument:
    """Save image, run Cloud Vision OCR, store IdDocument."""
    storage_root = Path(settings.storage_path) / "id_docs"
    if booking_id:
        storage_root = storage_root / str(booking_id)
    storage_root.mkdir(parents=True, exist_ok=True)

    filename = f"{uuid.uuid4().hex}.jpg"
    file_path = storage_root / filename

    try:
        buf = io.BytesIO(image_bytes)
        image = Image.open(buf)
        image.load()
        image.save(file_path, format="JPEG", quality=85)
    except Exception as exc:
        logger.exception("Failed to save ID image")
        raise AppException(
            "Could not save document image. Please proceed to reception.",
            ErrorCodes.STORAGE_FAILURE,
            500,
        ) from exc

    ocr_text = ""
    extracted = {"extracted_name": None, "extracted_dob": None, "extracted_id_number": None}
    try:
        ocr_text = _run_vision_ocr(image_bytes)
        extracted = _parse_ocr_text(ocr_text)
        logger.info(
            "Vision OCR ok: name=%s, dob=%s, id=%s",
            bool(extracted["extracted_name"]),
            bool(extracted["extracted_dob"]),
            bool(extracted["extracted_id_number"]),
        )
    except Exception as exc:
        logger.warning("Vision OCR failed, document saved without extracted fields: %s", exc)

    doc = IdDocument(
        booking_id=booking_id,
        file_path=str(file_path),
        ocr_raw=ocr_text[:2000] if ocr_text else None,
        extracted_name=extracted["extracted_name"],
        extracted_dob=extracted["extracted_dob"],
        extracted_id_number=extracted["extracted_id_number"],
    )
    db.add(doc)
    db.commit()
    db.refresh(doc)
    return doc


def check_ocr_available() -> bool:
    """Verify Cloud Vision credentials are configured."""
    try:
        from google.cloud import vision
        _resolve_credentials_path()
        client = vision.ImageAnnotatorClient()
        return client is not None
    except Exception as exc:
        logger.warning("Cloud Vision not available: %s", exc)
        return False


# Backward-compat alias for any code still calling the old name
check_tesseract_available = check_ocr_available