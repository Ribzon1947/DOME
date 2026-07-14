from datetime import datetime, timezone
from decimal import Decimal

from sqlalchemy.orm import Session

from app.models import PricingRule, RoomType


def calculate_booking_amount(
    db: Session, room_type_id: int, check_in: datetime, check_out: datetime
) -> Decimal:
    room_type = db.query(RoomType).filter(RoomType.id == room_type_id).first()
    if not room_type:
        return Decimal("0.00")

    nights = max(1, (check_out.date() - check_in.date()).days)
    amount = room_type.base_price * nights

    rules = (
        db.query(PricingRule)
        .filter(PricingRule.room_type_id == room_type_id, PricingRule.is_active.is_(True))
        .all()
    )

    multiplier = Decimal("1.0")
    for rule in rules:
        if check_in.weekday() >= 5:
            multiplier = max(multiplier, rule.weekend_multiplier)
        if rule.season_start and rule.season_end:
            if rule.season_start <= check_in <= rule.season_end:
                multiplier = max(multiplier, rule.season_multiplier)

    return (amount * multiplier).quantize(Decimal("0.01"))
