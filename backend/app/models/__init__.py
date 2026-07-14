import enum
from datetime import datetime
from decimal import Decimal

from sqlalchemy import DateTime, Enum, ForeignKey, Integer, Numeric, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class RoomStatus(str, enum.Enum):
    available = "available"
    occupied = "occupied"
    maintenance = "maintenance"


class RoomType(Base):
    __tablename__ = "room_types"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(100), unique=True)
    base_price: Mapped[Decimal] = mapped_column(Numeric(10, 2))
    description: Mapped[str | None] = mapped_column(Text, nullable=True)

    rooms: Mapped[list["Room"]] = relationship(back_populates="room_type")
    pricing_rules: Mapped[list["PricingRule"]] = relationship(back_populates="room_type")


class Room(Base):
    __tablename__ = "rooms"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    number: Mapped[str] = mapped_column(String(20), unique=True, index=True)
    room_type_id: Mapped[int] = mapped_column(ForeignKey("room_types.id"))
    status: Mapped[RoomStatus] = mapped_column(Enum(RoomStatus), default=RoomStatus.available)
    floor: Mapped[int | None] = mapped_column(Integer, nullable=True)

    room_type: Mapped["RoomType"] = relationship(back_populates="rooms")
    bookings: Mapped[list["Booking"]] = relationship(back_populates="room")


class BookingStatus(str, enum.Enum):
    pending = "pending"
    checked_in = "checked_in"
    checked_out = "checked_out"
    overstay = "overstay"
    expired = "expired"


class Booking(Base):
    __tablename__ = "bookings"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    room_id: Mapped[int] = mapped_column(ForeignKey("rooms.id"))
    created_by: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    customer_name: Mapped[str] = mapped_column(String(255))
    customer_email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    customer_phone: Mapped[str | None] = mapped_column(String(50), nullable=True)
    dob: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    id_number: Mapped[str | None] = mapped_column(String(50), nullable=True)
    check_in: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    check_out: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    status: Mapped[BookingStatus] = mapped_column(Enum(BookingStatus), default=BookingStatus.pending)
    amount: Mapped[Decimal] = mapped_column(Numeric(10, 2))
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    room: Mapped["Room"] = relationship(back_populates="bookings")
    created_by_user: Mapped["User | None"] = relationship(back_populates="bookings")
    payment: Mapped["Payment | None"] = relationship(back_populates="booking", uselist=False)
    id_document: Mapped["IdDocument | None"] = relationship(back_populates="booking", uselist=False)


class PaymentStatus(str, enum.Enum):
    pending = "pending"
    paid = "paid"
    failed = "failed"


class Payment(Base):
    __tablename__ = "payments"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    booking_id: Mapped[int] = mapped_column(ForeignKey("bookings.id"), unique=True)
    status: Mapped[PaymentStatus] = mapped_column(Enum(PaymentStatus), default=PaymentStatus.pending)
    amount: Mapped[Decimal] = mapped_column(Numeric(10, 2))
    upi_link: Mapped[str | None] = mapped_column(Text, nullable=True)
    razorpay_qr_id: Mapped[str | None] = mapped_column(String(100), nullable=True, index=True)
    razorpay_payment_id: Mapped[str | None] = mapped_column(String(100), nullable=True)
    razorpay_qr_image_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    paid_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    confirmed_by: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    booking: Mapped["Booking"] = relationship(back_populates="payment")
    transaction_logs: Mapped[list["TransactionLog"]] = relationship(back_populates="payment")
    

class TransactionLog(Base):
    __tablename__ = "transaction_logs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    payment_id: Mapped[int] = mapped_column(ForeignKey("payments.id"))
    action: Mapped[str] = mapped_column(String(100))
    amount: Mapped[Decimal] = mapped_column(Numeric(10, 2))
    metadata_json: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    payment: Mapped["Payment"] = relationship(back_populates="transaction_logs")


class IdDocument(Base):
    __tablename__ = "id_documents"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    booking_id: Mapped[int | None] = mapped_column(ForeignKey("bookings.id"), nullable=True)
    file_path: Mapped[str] = mapped_column(String(500))
    ocr_raw: Mapped[str | None] = mapped_column(Text, nullable=True)
    extracted_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    extracted_dob: Mapped[str | None] = mapped_column(String(50), nullable=True)
    extracted_id_number: Mapped[str | None] = mapped_column(String(50), nullable=True)
    purge_after: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    booking: Mapped["Booking | None"] = relationship(back_populates="id_document")

class FcmToken(Base):
    __tablename__ = "fcm_tokens"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    token: Mapped[str] = mapped_column(String(500), unique=True, index=True)
    device_label: Mapped[str | None] = mapped_column(String(100), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    last_used_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

class PricingRule(Base):
    __tablename__ = "pricing_rules"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    room_type_id: Mapped[int] = mapped_column(ForeignKey("room_types.id"))
    name: Mapped[str] = mapped_column(String(100))
    weekend_multiplier: Mapped[Decimal] = mapped_column(Numeric(5, 2), default=Decimal("1.0"))
    season_start: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    season_end: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    season_multiplier: Mapped[Decimal] = mapped_column(Numeric(5, 2), default=Decimal("1.0"))
    is_active: Mapped[bool] = mapped_column(default=True)

    room_type: Mapped["RoomType"] = relationship(back_populates="pricing_rules")


class Setting(Base):
    __tablename__ = "settings"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    key: Mapped[str] = mapped_column(String(100), unique=True, index=True)
    value: Mapped[str] = mapped_column(Text)


from app.models.user import User, UserRole

__all__ = [
    "User",
    "UserRole",
    "RoomType",
    "Room",
    "RoomStatus",
    "Booking",
    "BookingStatus",
    "Payment",
    "PaymentStatus",
    "TransactionLog",
    "IdDocument",
    "PricingRule",
    "Setting",
    "FcmToken"
]
