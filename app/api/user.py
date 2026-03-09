import logging

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, Query
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import func
from app.db.models import User, InfluencerWallet, DailyUsage, Pricing, InfluencerCreditTransaction
from app.db.session import get_db
from app.schemas.user import UserOut, UserUpdate, UserAdultPromptUpdate, UserAdultPromptOut
from app.utils.auth.dependencies import get_current_user
from app.utils.storage.s3 import (
    generate_user_presigned_url,
    delete_file_from_s3,
    save_user_photo_to_s3,
)

log = logging.getLogger(__name__)

router = APIRouter(prefix="/user", tags=["user"])


@router.get("/{id}/usage")
async def get_user_usage(
    id: int,
    influencer_id: str | None = Query(None, description="Filter by specific influencer ID"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")

    if influencer_id:
        wallets_result = await db.execute(
            select(InfluencerWallet).where(
                InfluencerWallet.user_id == id,
                InfluencerWallet.influencer_id == influencer_id,
            )
        )
    else:
        wallets_result = await db.execute(
            select(InfluencerWallet).where(InfluencerWallet.user_id == id)
        )
    wallets = wallets_result.scalars().all()

    usage_stmt = select(
        DailyUsage.is_18,
        func.sum(DailyUsage.text_count).label('total_text'),
        func.sum(DailyUsage.voice_secs).label('total_voice'),
        func.sum(DailyUsage.live_secs).label('total_live')
    ).where(DailyUsage.user_id == id).group_by(DailyUsage.is_18)
    
    usage_rows = (await db.execute(usage_stmt)).all()
    
    normal_usage_totals = {"text": 0, "voice": 0, "live": 0}
    adult_usage_totals = {"text": 0, "voice": 0, "live": 0}
    
    for row in usage_rows:
        if row.is_18:
            adult_usage_totals["text"] = row.total_text or 0
            adult_usage_totals["voice"] = row.total_voice or 0
            adult_usage_totals["live"] = row.total_live or 0
        else:
            normal_usage_totals["text"] = row.total_text or 0
            normal_usage_totals["voice"] = row.total_voice or 0
            normal_usage_totals["live"] = row.total_live or 0

    pricing_result = await db.execute(
        select(Pricing).where(Pricing.is_active.is_(True))
    )
    pricing_map = {p.feature: p for p in pricing_result.scalars().all()}

    last_call_result = await db.execute(
        select(
            InfluencerCreditTransaction.influencer_id,
            InfluencerCreditTransaction.feature,
            InfluencerCreditTransaction.units,
            InfluencerCreditTransaction.created_at,
        )
        .where(
            InfluencerCreditTransaction.user_id == id,
            InfluencerCreditTransaction.units < 0,
            InfluencerCreditTransaction.feature.in_(["live_chat", "voice_18"]),
        )
        .order_by(InfluencerCreditTransaction.created_at.desc())
    )
    last_call_rows = last_call_result.all()
    last_call_secs_by_influencer_feature: dict[tuple[str, str], int] = {}
    for row in last_call_rows:
        if not row.influencer_id or not row.feature:
            continue
        key = (row.influencer_id, row.feature)
        if key in last_call_secs_by_influencer_feature:
            continue
        last_call_secs_by_influencer_feature[key] = abs(int(row.units or 0))

    def get_price_info(feature: str) -> tuple[int, int]:
        price = pricing_map.get(feature)
        if not price:
            return (0, 0)
        return (price.price_cents or 0, price.free_allowance or 0)

    text_price, text_free = get_price_info("text")
    voice_price, voice_free = get_price_info("voice")
    live_price, live_free = get_price_info("live_chat")
    text_18_price, text_18_free = get_price_info("text_18")
    voice_18_price, voice_18_free = get_price_info("voice_18")

    # ── Free allowances (global, once per account) ──
    normal_text_used = normal_usage_totals["text"]
    normal_voice_used = normal_usage_totals["voice"]
    normal_live_used = normal_usage_totals["live"]
    adult_text_used = adult_usage_totals["text"]
    adult_voice_used = adult_usage_totals["voice"]

    normal_text_free_left = max(text_free - normal_text_used, 0)
    normal_voice_free_left = max(voice_free - normal_voice_used, 0)
    normal_live_free_left = max(live_free - normal_live_used, 0)
    adult_text_free_left = max(text_18_free - adult_text_used, 0)
    adult_voice_free_left = max(voice_18_free - adult_voice_used, 0)

    def build_normal_wallet(balance: int, *, last_call_seconds: int = 0) -> dict:
        """Build wallet info. `remaining` shows max purchasable from wallet only (no free)."""
        text_paid = balance // text_price if text_price > 0 else 0
        voice_paid = balance // voice_price if voice_price > 0 else 0
        live_paid = balance // live_price if live_price > 0 else 0
        return {
            "balance_cents": balance,
            "messages": {
                "remaining": text_paid,
                "unit_price_cents": text_price,
                "used_total": normal_text_used,
                "used_today": normal_text_used,  # backward compat
                "free_left": normal_text_free_left,  # backward compat
            },
            "voice_notes": {
                "remaining": voice_paid,
                "remaining_minutes": round(voice_paid / 60, 2),
                "unit_price_cents": voice_price,
                "used_total": normal_voice_used,
                "used_today": normal_voice_used,  # backward compat
                "free_left": normal_voice_free_left,  # backward compat
            },
            "live_chat": {
                "remaining": live_paid,
                "remaining_minutes": round(live_paid / 60, 2),
                "unit_price_cents": live_price,
                "used_total": normal_live_used,
                "used_today": normal_live_used,  # backward compat
                "free_left": normal_live_free_left,  # backward compat
                "last_call_seconds": int(last_call_seconds),
                "last_call_minutes": round(int(last_call_seconds) / 60, 2),
            },
        }

    def build_adult_wallet(balance: int, *, last_call_seconds: int = 0) -> dict:
        text_paid = balance // text_18_price if text_18_price > 0 else 0
        voice_paid = balance // voice_18_price if voice_18_price > 0 else 0
        return {
            "balance_cents": balance,
            "messages": {
                "remaining": text_paid,
                "unit_price_cents": text_18_price,
                "used_total": adult_text_used,
                "used_today": adult_text_used,  # backward compat
                "free_left": adult_text_free_left,  # backward compat
            },
            "voice": {
                "remaining": voice_paid,
                "remaining_minutes": round(voice_paid / 60, 2),
                "unit_price_cents": voice_18_price,
                "used_total": adult_voice_used,
                "used_today": adult_voice_used,  # backward compat
                "free_left": adult_voice_free_left,  # backward compat
                "last_call_seconds": int(last_call_seconds),
                "last_call_minutes": round(int(last_call_seconds) / 60, 2),
            },
        }

    # Free allowances are global (once per account), returned at top level
    normal_trial_available = (
        normal_text_free_left > 0
        or normal_voice_free_left > 0
        or normal_live_free_left > 0
    )
    adult_trial_available = (
        adult_text_free_left > 0
        or adult_voice_free_left > 0
    )

    free_allowances = {
        "normal": {
            "text_free_left": normal_text_free_left,
            "voice_notes_free_left": normal_voice_free_left,
            "live_chat_free_left": normal_live_free_left,
            "live_chat_free_left_minutes": round(normal_live_free_left / 60, 2),
            "free_trial_available": normal_trial_available,
        },
        "adult": {
            "text_free_left": adult_text_free_left,
            "voice_free_left": adult_voice_free_left,
            "voice_free_left_minutes": round(adult_voice_free_left / 60, 2),
            "free_trial_available": adult_trial_available,
        },
        "free_trial_available": normal_trial_available or adult_trial_available,
    }

    if influencer_id:
        normal_wallet = None
        adult_wallet = None

        for wallet in wallets:
            balance = wallet.balance_cents or 0
            if wallet.is_18:
                adult_wallet = build_adult_wallet(
                    balance,
                    last_call_seconds=last_call_secs_by_influencer_feature.get((influencer_id, "voice_18"), 0),
                )
            else:
                normal_wallet = build_normal_wallet(
                    balance,
                    last_call_seconds=last_call_secs_by_influencer_feature.get((influencer_id, "live_chat"), 0),
                )

        if normal_wallet is None:
            normal_wallet = build_normal_wallet(
                0,
                last_call_seconds=last_call_secs_by_influencer_feature.get((influencer_id, "live_chat"), 0),
            )
        if adult_wallet is None:
            adult_wallet = build_adult_wallet(
                0,
                last_call_seconds=last_call_secs_by_influencer_feature.get((influencer_id, "voice_18"), 0),
            )

        return {
            "influencer_id": influencer_id,
            "normal": normal_wallet,
            "adult": adult_wallet,
            "free_allowances": free_allowances,
        }

    influencer_wallets: dict[str, dict] = {}
    for wallet in wallets:
        inf_id = wallet.influencer_id
        if inf_id not in influencer_wallets:
            influencer_wallets[inf_id] = {"normal": None, "adult": None}

        balance = wallet.balance_cents or 0
        if wallet.is_18:
            influencer_wallets[inf_id]["adult"] = build_adult_wallet(
                balance,
                last_call_seconds=last_call_secs_by_influencer_feature.get((inf_id, "voice_18"), 0),
            )
        else:
            influencer_wallets[inf_id]["normal"] = build_normal_wallet(
                balance,
                last_call_seconds=last_call_secs_by_influencer_feature.get((inf_id, "live_chat"), 0),
            )

    total_normal_balance = sum((w.balance_cents or 0) for w in wallets if not w.is_18)
    total_adult_balance = sum((w.balance_cents or 0) for w in wallets if w.is_18)

    return {
        "influencers": influencer_wallets,
        "totals": {
            "normal": build_normal_wallet(total_normal_balance),
            "adult": build_adult_wallet(total_adult_balance),
        },
        "free_allowances": free_allowances,
    }

@router.get("/{id}", response_model=UserOut)
async def get_user_by_id(
    id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to view this profile")
        
    user_out = UserOut.model_validate(current_user)
    
    if current_user.profile_photo_key:
        user_out.profile_photo_url = generate_user_presigned_url(current_user.profile_photo_key)
        
    return user_out



@router.patch("/{id}/profile", response_model=UserOut)
async def update_user(
    id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    user_in: str | None = Form(default=None),
    file: UploadFile | None = File(default=None),
):
    if id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to update this profile")

    if user_in:
        user_data = UserUpdate.model_validate_json(user_in)
        update_data = user_data.model_dump(exclude_unset=True)

        new_username = update_data.get("username")
        if new_username and new_username != current_user.username:
            existing_user = await db.execute(
                select(User.id).where(
                    User.username == new_username,
                    User.id != current_user.id,
                )
            )
            if existing_user.scalar_one_or_none() is not None:
                raise HTTPException(status_code=409, detail="Username already taken")

        for field, value in update_data.items():
            setattr(current_user, field, value)

    if file:
        previous_key = current_user.profile_photo_key
        try:
            key = await save_user_photo_to_s3(
                file.file,
                file.filename or "profile.jpg",
                file.content_type or "image/jpeg",
                current_user.id
            )
            current_user.profile_photo_key = key
        except Exception as e:
            log.error(f"Failed to upload user photo: {e}", exc_info=True)
            raise HTTPException(500, "Failed to upload photo")

    db.add(current_user)
    try:
        await db.commit()
        await db.refresh(current_user)
    except IntegrityError as exc:
        await db.rollback()
        if file and current_user.profile_photo_key and current_user.profile_photo_key != previous_key:
            try:
                await delete_file_from_s3(current_user.profile_photo_key)
            except Exception:
                log.warning("Failed to rollback uploaded S3 photo", exc_info=True)
        if "username" in str(exc.orig).lower():
            raise HTTPException(status_code=409, detail="Username already taken") from exc
        raise HTTPException(status_code=400, detail="Profile update violates a database constraint") from exc
    except Exception:
        await db.rollback()
        if file and current_user.profile_photo_key and current_user.profile_photo_key != previous_key:
            try:
                await delete_file_from_s3(current_user.profile_photo_key)
            except Exception:
                log.warning("Failed to rollback uploaded S3 photo", exc_info=True)
        raise

    if file and previous_key and previous_key != current_user.profile_photo_key:
        try:
            await delete_file_from_s3(previous_key)
        except Exception:
            log.warning("Failed to delete previous S3 photo %s", previous_key, exc_info=True)

    user_out = UserOut.model_validate(current_user)
    if current_user.profile_photo_key:
        user_out.profile_photo_url = generate_user_presigned_url(current_user.profile_photo_key)
        
    return user_out


@router.patch("/adult-prompt", response_model=UserAdultPromptOut)
async def update_user_adult_prompt(
    payload: UserAdultPromptUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    current_user.custom_adult_prompt = payload.custom_adult_prompt
    db.add(current_user)
    await db.commit()
    await db.refresh(current_user)

    return UserAdultPromptOut(custom_adult_prompt=current_user.custom_adult_prompt)


@router.post("/{id}/photo", response_model=UserOut)
async def upload_user_photo_endpoint(
    id: int,
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Upload functionality for user profile photo"""
    if id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to upload photo for this profile")

    if not file:
        raise HTTPException(400, "No file uploaded")
        
    previous_key = current_user.profile_photo_key

    try:
        key = await save_user_photo_to_s3(
            file.file, 
            file.filename or "profile.jpg", 
            file.content_type or "image/jpeg", 
            current_user.id
        )
        current_user.profile_photo_key = key
        db.add(current_user)
        try:
            await db.commit()
            await db.refresh(current_user)
        except Exception:
            await db.rollback()
            if key and key != previous_key:
                try:
                    await delete_file_from_s3(key)
                except Exception:
                    log.warning("Failed to rollback uploaded S3 photo %s", key, exc_info=True)
            raise

        if previous_key and previous_key != key:
            try:
                await delete_file_from_s3(previous_key)
            except Exception:
                log.warning("Failed to delete previous S3 photo %s", previous_key, exc_info=True)
        
        user_out = UserOut.model_validate(current_user)
        user_out.profile_photo_url = generate_user_presigned_url(key)
        return user_out
        
    except Exception as e:
        log.error(f"Failed to upload user photo: {e}", exc_info=True)
        raise HTTPException(500, "Failed to upload photo")
