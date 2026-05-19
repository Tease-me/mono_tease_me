import io
import logging
import re
import secrets
from datetime import datetime, timezone

from fastapi import (
    APIRouter,
    Depends,
    File,
    Form,
    HTTPException,
    Query,
    Response,
    UploadFile,
    status,
)
from pydantic import ValidationError
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.session import get_db
from app.data.models import Influencer, PreInfluencer, User
from app.data.schemas.pre_influencer import (
    InfluencerAudioDeleteRequest,
    PreInfluencerAdminOut,
    PreInfluencerAcceptTermsRequest,
    PreInfluencerAudioListOut,
    PreInfluencerRegisterRequest,
    PreInfluencerRegisterResponse,
    SurveyPromptResponse,
    SurveyQuestionsResponse,
    SurveySaveRequest,
    SurveyState,
)
from app.services.email.mailers import (
    send_influencer_survey_completed_email_to_promoter,
    send_profile_survey_email,
)
from app.services.mjpromoter import (
    fp_extract_email,
    fp_extract_parent_promoter_id,
    fp_find_promoter_id_by_ref_token,
    fp_get_promoter_v2,
    fp_track_signup,
)
from app.services.use_cases.approve_pre_influencer import (
    approve_pre_influencer as run_pre_influencer_approval,
)
from app.services.use_cases.mj_pre_influencer_progress import derive_mj_survey_step
from app.services.use_cases.mjfp_pre_influencer_webhook import (
    schedule_mjfp_pre_influencer_step_webhook,
)
from app.services.use_cases.pre_influencer_output import build_pre_influencer_admin_out
from app.services.use_cases import pre_influencer_storage
from app.services.use_cases.pre_influencer_survey_prompt import (
    format_survey_markdown,
    generate_prompt_from_markdown,
    load_survey_questions,
)
from app.utils.auth.dependencies import get_current_pre_influencer, get_current_user
from app.utils.storage.s3 import (
    delete_file_from_s3,
    generate_presigned_url,
    s3,
    save_influencer_photo_to_s3,
)

log = logging.getLogger(__name__)
router = APIRouter(prefix="/pre-influencers", tags=["Pre Influencers"])


def normalize_influencer_id(username: str) -> str:
    return re.sub(r"[^a-z0-9_]", "", username.lower())


@router.get("/me")
async def get_pre_influencer_me(
    current_pre: PreInfluencer = Depends(get_current_pre_influencer),
):
    return build_pre_influencer_admin_out(current_pre)


@router.get("/check-ig/{instagram_username}")
async def check_instagram_exists(
    instagram_username: str,
    db: AsyncSession = Depends(get_db),
):
    search_term = instagram_username.strip().lstrip("@")

    result = await db.execute(
        select(PreInfluencer).where(PreInfluencer.username.ilike(search_term))
    )
    all_matches = result.scalars().all()

    normalized_search_id = normalize_influencer_id(search_term)
    existing_influencer = await db.get(Influencer, normalized_search_id)

    best_pre = None
    if all_matches:
        best_pre = sorted(
            all_matches,
            key=lambda x: (1 if x.status == "approved" else 0, x.created_at),
            reverse=True,
        )[0]

        if not existing_influencer:
            if best_pre.email:
                res = await db.execute(
                    select(Influencer).where(Influencer.email == best_pre.email)
                )
                existing_influencer = res.scalar_one_or_none()

        if not existing_influencer:
            if best_pre.full_name:
                res = await db.execute(
                    select(Influencer).where(
                        Influencer.display_name == best_pre.full_name
                    )
                )
                existing_influencer = res.scalar_one_or_none()

    if existing_influencer:
        return {
            "exists": True,
            "instagram_username": existing_influencer.display_name,
            "pre_influencer_id": best_pre.id if best_pre else None,
            "status": "approved",
            "is_approved": True,
            "has_influencer_profile": True,
            "display_name": existing_influencer.display_name,
            "message": "This influencer is active in our system.",
        }

    if best_pre:
        return {
            "exists": True,
            "instagram_username": best_pre.username,
            "pre_influencer_id": best_pre.id,
            "status": best_pre.status,
            "is_approved": best_pre.status == "approved",
            "has_influencer_profile": False,
            "display_name": best_pre.full_name,
            "message": f"This influencer is in our system with status: {best_pre.status}",
        }

    return {
        "exists": False,
        "instagram_username": search_term,
        "message": "This influencer is not in our system yet.",
    }


def _require_pre_influencer_survey_access(
    pre: PreInfluencer,
    token: str,
    temp_password: str,
) -> None:
    if (
        not pre.survey_token
        or not token
        or not secrets.compare_digest(pre.survey_token, token)
    ):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Invalid or expired survey link",
        )
    if (
        not pre.password
        or not temp_password
        or not secrets.compare_digest(pre.password, temp_password)
    ):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid temporary password",
        )


@router.post("/{pre_id}/accept-terms")
async def accept_pre_influencer_terms(
    pre_id: int,
    payload: PreInfluencerAcceptTermsRequest,
    db: AsyncSession = Depends(get_db),
):
    res = await db.execute(select(PreInfluencer).where(PreInfluencer.id == pre_id))
    pre = res.scalar_one_or_none()
    if not pre:
        raise HTTPException(status_code=404, detail="Pre-influencer not found")

    pre.terms_agreement = True
    await db.commit()
    await db.refresh(pre)
    schedule_mjfp_pre_influencer_step_webhook(pre.id)
    try:
        await _try_notify_parent_promoter_when_ready(pre, db)
    except Exception:
        log.exception(
            "Failed to notify parent promoter after terms acceptance pre_id=%s",
            pre.id,
        )
    return {"ok": True, "terms_agreement": True}


@router.post("/register", response_model=PreInfluencerRegisterResponse)
async def register_pre_influencer(
    data: PreInfluencerRegisterRequest,
    db: AsyncSession = Depends(get_db),
):
    existing = await db.execute(
        select(PreInfluencer).where(
            or_(
                PreInfluencer.email == data.email,
                PreInfluencer.username == data.username,
            )
        )
    )
    if existing.scalar():
        raise HTTPException(
            status_code=200,
            detail="Username or email already registered as pre-influencer",
        )

    verify_token = secrets.token_urlsafe(32)
    registration_meta = {
        "fpr": data.fpr,
        "invite_code": data.invite_code,
        "invitee_email": data.invitee_email,
        "inviter_email": data.inviter_email,
        "account_manager_email": data.account_manager_email,
        "parent_ref_id": data.parent_ref_id,
    }
    registration_meta = {
        key: value for key, value in registration_meta.items() if value is not None
    }

    pre = PreInfluencer(
        full_name=data.full_name,
        location=data.location,
        username=data.username,
        email=data.email,
        password=data.password,
        survey_token=verify_token,
        survey_answers={"__meta": registration_meta} if registration_meta else None,
        terms_agreement=False,
    )

    db.add(pre)
    await db.commit()
    await db.refresh(pre)
    schedule_mjfp_pre_influencer_step_webhook(pre.id)

    # Track pre-influencer signup in MJFP (if fp_tid provided)
    if data.fp_tid:
        try:
            await fp_track_signup(
                email=pre.email,
                uid=f"preinf-{pre.id}",
                tid=data.fp_tid,
            )
        except Exception:
            log.exception(
                "MJFP track signup failed for pre-influencer %s", pre.id
            )

    send_profile_survey_email(
        pre.email,
        verify_token,
        data.password,
    )

    return PreInfluencerRegisterResponse(
        ok=True,
        user_id=pre.id,
        email=pre.email,
        message="Check your email.",
    )


@router.post("/resend-survey")
async def resend_pre_influencer_survey(
    identifier: str,
    db: AsyncSession = Depends(get_db),
):
    """
    identifier = username OR email
    """

    result = await db.execute(
        select(PreInfluencer).where(
            or_(
                PreInfluencer.username == identifier,
                PreInfluencer.email == identifier,
            )
        )
    )
    pre = result.scalar_one_or_none()

    if not pre:
        raise HTTPException(status_code=404, detail="Pre-influencer not found")

    if not pre.survey_token:
        raise HTTPException(status_code=400, detail="Survey token missing")

    send_profile_survey_email(
        pre.email,
        pre.survey_token,
        pre.password,
    )

    return {
        "ok": True,
        "username": pre.username,
        "email": pre.email,
        "message": "Survey email resent",
    }


@router.get("/survey", response_model=SurveyState)
async def open_survey(
    token: str,
    temp_password: str = Query(...),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(PreInfluencer).where(PreInfluencer.survey_token == token)
    )
    pre = result.scalar_one_or_none()

    if not pre:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Invalid or expired survey link",
        )

    _require_pre_influencer_survey_access(pre, token, temp_password)

    return SurveyState(
        pre_influencer_id=pre.id,
        username=pre.username,
        survey_answers=pre.survey_answers or {},
        survey_step=pre.survey_step or 0,
    )


@router.get("/survey/questions", response_model=SurveyQuestionsResponse)
async def get_survey_questions(db: AsyncSession = Depends(get_db)):
    return SurveyQuestionsResponse(sections=await load_survey_questions(db))


@router.get("/{pre_id}/survey/markdown")
async def get_survey_markdown(
    pre_id: int,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(PreInfluencer).where(PreInfluencer.id == pre_id))
    pre = result.scalar_one_or_none()

    if not pre:
        raise HTTPException(status_code=404, detail="Pre-influencer not found")

    sections = await load_survey_questions(db)

    markdown = format_survey_markdown(sections, pre.survey_answers or {}, pre.username)
    return Response(content=markdown, media_type="text/markdown")


@router.get("/{pre_id}/survey/generate-prompt", response_model=SurveyPromptResponse)
async def generate_prompt_from_survey(
    pre_id: int,
    additional_prompt: str | None = None,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(PreInfluencer).where(PreInfluencer.id == pre_id))
    pre = result.scalar_one_or_none()

    if not pre:
        raise HTTPException(status_code=404, detail="Pre-influencer not found")

    sections = await load_survey_questions(db)
    markdown = format_survey_markdown(sections, pre.survey_answers or {}, pre.username)
    prompt = await generate_prompt_from_markdown(
        markdown, additional_prompt=additional_prompt, db=db
    )
    try:
        return SurveyPromptResponse(**prompt)
    except ValidationError as exc:
        log.warning(
            "survey_prompt.response_validation_failed errors=%s payload=%s",
            exc.errors(),
            prompt,
        )
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Prompt generation returned an invalid schema payload.",
        )


def _survey_is_completed(survey_step: int, total_sections: int) -> bool:
    if total_sections <= 0:
        return False
    return int(survey_step) >= max(total_sections - 1, 0)


_SERVER_PRESERVED_SURVEY_META_KEYS = (
    "parent_promoter_survey_completed_notified",
    "parent_promoter_survey_completed_notified_at",
    "parent_promoter_id",
)


def _merge_survey_answers(
    existing_answers: dict | None,
    incoming_answers: dict,
) -> dict:
    """Merge survey answers while keeping server-owned __meta fields."""
    if not isinstance(existing_answers, dict):
        return incoming_answers

    existing_meta = existing_answers.get("__meta")
    if not isinstance(existing_meta, dict):
        return incoming_answers

    incoming_meta = incoming_answers.get("__meta")
    if not isinstance(incoming_meta, dict):
        merged = dict(incoming_answers)
        merged["__meta"] = dict(existing_meta)
        return merged

    preserved = {
        key: existing_meta[key]
        for key in _SERVER_PRESERVED_SURVEY_META_KEYS
        if key in existing_meta
    }
    merged = dict(incoming_answers)
    merged["__meta"] = {**incoming_meta, **preserved}
    return merged


async def _try_notify_parent_promoter_when_ready(
    pre: PreInfluencer, db: AsyncSession
) -> None:
    if not pre.terms_agreement:
        return
    try:
        total_sections = len(await load_survey_questions(db))
        completed = _survey_is_completed(int(pre.survey_step or 0), total_sections)
    except Exception:
        log.exception(
            "Failed to evaluate survey completion for parent promoter notify pre_id=%s",
            pre.id,
        )
        return
    if not completed:
        return
    await _notify_parent_promoter_if_needed(pre, db)


async def _notify_parent_promoter_if_needed(
    pre: PreInfluencer, db: AsyncSession
) -> None:
    answers = pre.survey_answers or {}
    meta = answers.get("__meta") if isinstance(answers, dict) else None
    if not isinstance(meta, dict):
        meta = {}

    if meta.get("parent_promoter_survey_completed_notified"):
        return

    parent_promoter_id: int | str | None = None
    raw_parent_promoter_id = meta.get("parent_promoter_id")
    if raw_parent_promoter_id is not None:
        raw_s = str(raw_parent_promoter_id).strip()
        if raw_s.isdigit():
            parent_promoter_id = int(raw_s)
        elif raw_s:
            parent_promoter_id = raw_s

    if parent_promoter_id is None:
        parent_ref_id = meta.get("parent_ref_id")
        if isinstance(parent_ref_id, str) and parent_ref_id.strip():
            inferred_parent = await fp_find_promoter_id_by_ref_token(
                parent_ref_id.strip()
            )
            if inferred_parent:
                parent_promoter_id = inferred_parent
                meta["parent_promoter_id"] = parent_promoter_id

    if parent_promoter_id is None and pre.fp_promoter_id:
        influencer_payload = await fp_get_promoter_v2(pre.fp_promoter_id)
        inferred_parent = fp_extract_parent_promoter_id(influencer_payload)
        if inferred_parent:
            parent_promoter_id = inferred_parent
            meta["parent_promoter_id"] = parent_promoter_id

    to_email: str | None = None
    if parent_promoter_id is not None:
        parent_payload = await fp_get_promoter_v2(parent_promoter_id)
        to_email = fp_extract_email(parent_payload)

    if not to_email:
        account_manager_email = meta.get("account_manager_email")
        if isinstance(account_manager_email, str):
            to_email = account_manager_email.strip() or None

    if not to_email:
        answers["__meta"] = meta
        pre.survey_answers = answers
        db.add(pre)
        await db.commit()
        return

    resp = send_influencer_survey_completed_email_to_promoter(
        to_email=to_email,
        influencer_username=pre.username,
        influencer_full_name=pre.full_name,
        influencer_email=pre.email,
    )
    if not resp:
        log.warning(
            "Survey completion email not sent for pre_id=%s parent_email=%s",
            pre.id,
            to_email,
        )
        return

    notified_at = datetime.now(timezone.utc).isoformat()
    meta["parent_promoter_survey_completed_notified"] = True
    meta["parent_promoter_survey_completed_notified_at"] = notified_at
    answers["__meta"] = meta
    pre.survey_answers = answers
    db.add(pre)
    await db.commit()


@router.put("/{pre_id}/survey", response_model=SurveyState)
async def save_survey_state(
    pre_id: int,
    data: SurveySaveRequest,
    token: str = Query(...),
    temp_password: str = Query(...),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(PreInfluencer).where(PreInfluencer.id == pre_id))
    pre = result.scalar_one_or_none()

    if not pre:
        raise HTTPException(status_code=404, detail="Pre-influencer not found")

    _require_pre_influencer_survey_access(pre, token, temp_password)

    incoming_answers: dict = data.survey_answers or {}
    existing_answers = pre.survey_answers or {}
    if isinstance(existing_answers, dict):
        incoming_answers = _merge_survey_answers(existing_answers, incoming_answers)

    pre.survey_answers = incoming_answers
    pre.survey_step = data.survey_step

    try:
        total_sections = len(await load_survey_questions(db))
        completed = _survey_is_completed(int(data.survey_step), total_sections)
    except Exception:
        completed = False

    await db.commit()
    await db.refresh(pre)

    if completed:
        try:
            await _try_notify_parent_promoter_when_ready(pre, db)
        except Exception:
            log.exception(
                "Failed to notify parent promoter on survey completion pre_id=%s", pre.id
            )
        await db.refresh(pre)

    if (settings.MJFP_WEBHOOK_URL or "").strip() and (settings.MJFP_WEBHOOK_SECRET or ""):
        derived = await derive_mj_survey_step(db, pre)
        stored = pre.mjfp_last_notified_derived_step
        if stored is None or stored != derived:
            schedule_mjfp_pre_influencer_step_webhook(pre.id)

    return SurveyState(
        pre_influencer_id=pre.id,
        username=pre.username,
        survey_answers=pre.survey_answers or {},
        survey_step=pre.survey_step or 0,
    )


@router.post("/upload-picture")
async def upload_pre_influencer_picture(
    pre_influencer_id: int = Form(...),
    token: str = Query(...),
    temp_password: str = Query(...),
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(PreInfluencer).where(PreInfluencer.id == pre_influencer_id)
    )
    pre = result.scalar_one_or_none()

    if not pre:
        raise HTTPException(status_code=404, detail="Pre-influencer not found")

    _require_pre_influencer_survey_access(pre, token, temp_password)

    if not pre.username:
        raise HTTPException(
            status_code=400,
            detail="Pre-influencer has no username to store picture under",
        )

    answers = pre.survey_answers or {}
    previous_key = answers.get("profile_picture_key")

    s3_key = await save_influencer_photo_to_s3(
        file.file,
        file.filename or "profile.jpg",
        file.content_type or "image/jpeg",
        influencer_id=pre.username,
    )

    answers["profile_picture_key"] = s3_key
    pre.survey_answers = answers

    try:
        await db.commit()
        await db.refresh(pre)
    except Exception:
        await db.rollback()
        if s3_key and s3_key != previous_key:
            try:
                await delete_file_from_s3(s3_key)
            except Exception:
                log.warning(
                    "Failed to rollback uploaded S3 picture %s", s3_key, exc_info=True
                )
        raise

    if previous_key and previous_key != s3_key:
        try:
            await delete_file_from_s3(previous_key)
        except Exception:
            log.warning(
                "Failed to delete previous S3 picture %s", previous_key, exc_info=True
            )

    if not previous_key and s3_key:
        schedule_mjfp_pre_influencer_step_webhook(pre.id)
    return {"s3_key": s3_key}


@router.get("/{pre_id}/picture-url")
async def get_pre_influencer_picture_url(
    pre_id: int,
    token: str = Query(...),
    temp_password: str = Query(...),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(PreInfluencer).where(PreInfluencer.id == pre_id))
    pre = result.scalar_one_or_none()

    if not pre:
        raise HTTPException(status_code=404, detail="Pre-influencer not found")

    _require_pre_influencer_survey_access(pre, token, temp_password)

    answers = pre.survey_answers or {}
    key = answers.get("profile_picture_key")
    if not key:
        raise HTTPException(status_code=404, detail="No picture stored")

    url = generate_presigned_url(key, expires=3600)
    return {"url": url}


@router.post("/{pre_id}/audio")
async def upload_pre_influencer_audio(
    pre_id: int,
    token: str = Query(...),
    temp_password: str = Query(...),
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(PreInfluencer).where(PreInfluencer.id == pre_id))
    pre = result.scalar_one_or_none()

    if not pre:
        raise HTTPException(status_code=404, detail="Pre-influencer not found")

    _require_pre_influencer_survey_access(pre, token, temp_password)

    file_bytes = await file.read()
    if not file_bytes:
        raise HTTPException(400, "Empty file")

    key = await pre_influencer_storage.save_audio(
        io.BytesIO(file_bytes),
        file.filename or "audio.webm",
        file.content_type or "audio/webm",
        str(pre.id),
    )

    return {"key": key, "url": pre_influencer_storage.generate_audio_download_url(key)}


@router.get("/{pre_id}/audio", response_model=PreInfluencerAudioListOut)
async def list_pre_influencer_audio(
    pre_id: int,
    token: str = Query(...),
    temp_password: str = Query(...),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(PreInfluencer).where(PreInfluencer.id == pre_id))
    pre = result.scalar_one_or_none()

    if not pre:
        raise HTTPException(status_code=404, detail="Pre-influencer not found")

    _require_pre_influencer_survey_access(pre, token, temp_password)

    keys = await pre_influencer_storage.list_audio_keys(str(pre.id))
    files = [
        {
            "key": key,
            "download_url": pre_influencer_storage.generate_audio_download_url(key),
        }
        for key in keys
    ]

    return PreInfluencerAudioListOut(
        pre_influencer_id=pre.id,
        count=len(files),
        files=files,
    )


@router.delete("/influencer-audio/{influencer_id}")
async def delete_influencer_audio(
    influencer_id: str,
    payload: InfluencerAudioDeleteRequest,
    db: AsyncSession = Depends(get_db),
):
    key = payload.key

    try:
        await pre_influencer_storage.delete_audio(influencer_id, key)
    except ValueError:
        raise HTTPException(
            status_code=400, detail="Invalid audio key for this influencer"
        ) from None

    return {"ok": True}


@router.get("/default-voices")
async def get_default_voices(db: AsyncSession = Depends(get_db)):
    bucket = settings.BUCKET_NAME
    prefix = "voices_default/"

    try:
        response = s3.list_objects_v2(
            Bucket=bucket,
            Prefix=prefix,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    contents = response.get("Contents", [])
    if not contents:
        return {"voices": []}

    voices = []
    for obj in contents:
        key = obj["Key"]

        if key.endswith("/"):
            continue

        voices.append(
            {
                "key": key,
                "filename": key.split("/")[-1],
                "url": generate_presigned_url(key, expires=3600),
            }
        )

    return {
        "count": len(voices),
        "voices": voices,
    }

@router.get("", response_model=list[PreInfluencerAdminOut])
async def list_pre_influencers(
    status: str | None = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if current_user.id != 1:
        raise HTTPException(status_code=403, detail="Admin only")
    q = select(PreInfluencer)
    if status:
        q = q.where(PreInfluencer.status == status)
    rows = (await db.execute(q)).scalars().all()
    return [build_pre_influencer_admin_out(row) for row in rows]


@router.get("/{pre_id}", response_model=PreInfluencerAdminOut)
async def get_pre_influencer(
    pre_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if current_user.id != 1:
        raise HTTPException(status_code=403, detail="Admin only")
    q = select(PreInfluencer).where(PreInfluencer.id == pre_id)
    row = (await db.execute(q)).scalar_one_or_none()
    if not row:
        raise HTTPException(status_code=404, detail="PreInfluencer not found")
    return build_pre_influencer_admin_out(row)


@router.post("/{pre_id}/approve")
async def approve_pre_influencer(
    pre_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if current_user.id != 1:
        raise HTTPException(status_code=403, detail="Admin only")
    return await run_pre_influencer_approval(db, pre_id)
