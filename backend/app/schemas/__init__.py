from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, EmailStr, Field

from app.models import BookingStatus, PaymentStatus, RoomStatus, UserRole


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class RefreshRequest(BaseModel):
    refresh_token: str


class UserResponse(BaseModel):
    id: int
    email: str
    full_name: str
    role: UserRole
    is_active: bool

    model_config = {"from_attributes": True}


class UserCreate(BaseModel):
    email: EmailStr
    full_name: str
    password: str
    role: UserRole = UserRole.receptionist


class RoomTypeResponse(BaseModel):
    id: int
    name: str
    base_price: Decimal
    description: str | None

    model_config = {"from_attributes": True}


class RoomCreate(BaseModel):
    number: str = Field(max_length=20)
    room_type_id: int
    floor: int | None = None
    status: RoomStatus = RoomStatus.available


class RoomUpdate(BaseModel):
    number: str | None = Field(default=None, max_length=20)
    room_type_id: int | None = None
    floor: int | None = None
    status: RoomStatus | None = None


class RoomResponse(BaseModel):
    id: int
    number: str
    room_type_id: int
    status: RoomStatus
    floor: int | None
    room_type: RoomTypeResponse | None = None

    model_config = {"from_attributes": True}


class BookingCreate(BaseModel):
    room_id: int
    customer_name: str
    customer_email: str | None = None
    customer_phone: str | None = None
    dob: datetime | None = None
    id_number: str | None = None
    check_in: datetime
    check_out: datetime
    notes: str | None = None
    document_id: int | None = None


class BookingUpdate(BaseModel):
    room_id: int | None = None
    customer_name: str | None = None
    customer_email: str | None = None
    customer_phone: str | None = None
    check_in: datetime | None = None
    check_out: datetime | None = None
    status: BookingStatus | None = None
    notes: str | None = None


class PaymentBrief(BaseModel):
    id: int
    status: PaymentStatus
    amount: Decimal
    paid_at: datetime | None

    model_config = {"from_attributes": True}


class IdDocumentBrief(BaseModel):
    id: int
    extracted_name: str | None
    extracted_dob: str | None
    extracted_id_number: str | None

    model_config = {"from_attributes": True}


class BookingResponse(BaseModel):
    id: int
    room_id: int
    customer_name: str
    customer_email: str | None
    customer_phone: str | None
    dob: datetime | None
    id_number: str | None
    check_in: datetime
    check_out: datetime
    status: BookingStatus
    amount: Decimal
    notes: str | None
    room: RoomResponse | None = None
    payment: PaymentBrief | None = None
    id_document: IdDocumentBrief | None = None

    model_config = {"from_attributes": True}


class CalendarCell(BaseModel):
    date: str
    booking_id: int | None = None
    status: str | None = None
    customer_name: str | None = None


class CalendarRow(BaseModel):
    room_id: int
    room_number: str
    cells: list[CalendarCell]


class CalendarResponse(BaseModel):
    start_date: str
    end_date: str
    rows: list[CalendarRow]


class PaymentInitiateResponse(BaseModel):
    payment_id: int
    amount: Decimal
    upi_link: str
    upi_id: str
    qr_base64: str
    status: PaymentStatus


class PaymentStatusResponse(BaseModel):
    payment_id: int
    status: PaymentStatus
    paid_at: datetime | None


class OcrResult(BaseModel):
    document_id: int
    extracted_name: str | None
    extracted_dob: str | None
    extracted_id_number: str | None


class RoomTypeUpdate(BaseModel):
    base_price: Decimal | None = None
    description: str | None = None


class PricingRuleCreate(BaseModel):
    room_type_id: int
    name: str
    weekend_multiplier: Decimal = Decimal("1.0")
    season_start: datetime | None = None
    season_end: datetime | None = None
    season_multiplier: Decimal = Decimal("1.0")
    is_active: bool = True


class PricingRuleResponse(BaseModel):
    id: int
    room_type_id: int
    name: str
    weekend_multiplier: Decimal
    season_start: datetime | None
    season_end: datetime | None
    season_multiplier: Decimal
    is_active: bool

    model_config = {"from_attributes": True}


class SettingUpdate(BaseModel):
    key: str
    value: str


class SettingResponse(BaseModel):
    key: str
    value: str


class TransactionLogResponse(BaseModel):
    id: int
    payment_id: int
    action: str
    amount: Decimal
    metadata_json: str | None
    created_at: datetime

    model_config = {"from_attributes": True}


class ErrorResponse(BaseModel):
    status: str = "error"
    message: str
    code: int
