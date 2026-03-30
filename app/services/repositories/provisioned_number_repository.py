"""
Repository for ProvisionedNumber DB operations.

All database queries for the provisioned_number table live here.
"""

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.data.models.provisioned_number import ProvisionedNumber
from app.data.enums.telegram_session_status import TelegramSessionStatus


async def create(
    db: AsyncSession,
    *,
    phone_number: str,
    twilio_sid: str,
    country_code: str,
    influencer_id: str | None = None,
    telegram_first_name: str = "User",
    telegram_last_name: str = "",
) -> ProvisionedNumber:
    """Insert a new provisioned number record."""
    record = ProvisionedNumber(
        phone_number=phone_number,
        twilio_sid=twilio_sid,
        country_code=country_code,
        influencer_id=influencer_id,
        telegram_session_status=TelegramSessionStatus.PENDING,
        telegram_first_name=telegram_first_name,
        telegram_last_name=telegram_last_name or None,
        is_active=True,
    )
    db.add(record)
    await db.commit()
    await db.refresh(record)
    return record


async def get_by_id(db: AsyncSession, number_id: int) -> ProvisionedNumber | None:
    """Fetch a provisioned number by primary key."""
    return await db.get(ProvisionedNumber, number_id)


async def get_by_phone(db: AsyncSession, phone_number: str) -> ProvisionedNumber | None:
    """Fetch a provisioned number by E.164 phone number."""
    result = await db.execute(
        select(ProvisionedNumber).where(ProvisionedNumber.phone_number == phone_number)
    )
    return result.scalar_one_or_none()


async def list_all(db: AsyncSession) -> list[ProvisionedNumber]:
    """List all provisioned numbers ordered by newest first."""
    result = await db.execute(
        select(ProvisionedNumber).order_by(ProvisionedNumber.created_at.desc())
    )
    return list(result.scalars().all())


async def update_status(
    db: AsyncSession,
    record: ProvisionedNumber,
    *,
    status: str,
    error_message: str | None = None,
    telegram_user_id: int | None = None,
    telegram_username: str | None = None,
) -> ProvisionedNumber:
    """Update the Telegram session status and related fields."""
    record.telegram_session_status = status
    record.error_message = error_message
    if telegram_user_id is not None:
        record.telegram_user_id = telegram_user_id
    if telegram_username is not None:
        record.telegram_username = telegram_username
    await db.commit()
    await db.refresh(record)
    return record


async def delete(db: AsyncSession, record: ProvisionedNumber) -> None:
    """Delete a provisioned number record."""
    await db.delete(record)
    await db.commit()
