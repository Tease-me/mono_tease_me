import json
import logging
import mimetypes
import re
from datetime import datetime, timezone

from fastapi import HTTPException
from fastapi.concurrency import run_in_threadpool
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.data.enums import InfluencerPublicationStatus
from app.data.models import Influencer, PreInfluencer, User
from app.services.email.mailers import send_pre_influencer_converted_admin_email
from app.services.mjpromoter import (
    fp_create_promoter,
    fp_find_promoter_id_by_ref_token,
)
from app.services.gateways.elevenlabs.agents_gateway import ElevenLabsAgentsGateway
from app.services.gateways.elevenlabs.voices_gateway import ElevenLabsVoicesGateway
from app.services.use_cases import pre_influencer_storage
from app.services.use_cases.mjfp_pre_influencer_webhook import (
    schedule_mjfp_pre_influencer_step_webhook,
)
from app.services.use_cases.pre_influencer_survey_prompt import (
    format_survey_markdown,
    generate_prompt_from_markdown,
    load_survey_questions,
)
from app.utils.storage.s3 import (
    copy_pre_influencer_audio_to_influencer_audio,
    get_s3_object_bytes,
    list_influencer_audio_keys,
)

log = logging.getLogger(__name__)

_voices_gateway = ElevenLabsVoicesGateway()
_agents_gateway = ElevenLabsAgentsGateway()


def _normalize_influencer_id(username: str) -> str:
    return re.sub(r"[^a-z0-9_]", "", username.lower())


async def _resolve_influencer_for_approval(
    db: AsyncSession,
    *,
    influencer_id: str,
    email: str | None,
) -> Influencer | None:
    """Match by username id first, then by unique email (re-approval / username change)."""
    influencer = await db.get(Influencer, influencer_id)
    if influencer is not None:
        return influencer
    if not email or not str(email).strip():
        return None
    result = await db.execute(
        select(Influencer).where(Influencer.email == str(email).strip())
    )
    existing = result.scalar_one_or_none()
    if existing is not None and existing.id != influencer_id:
        log.info(
            "Approval reusing influencer id=%s for pre email=%s (username maps to %s)",
            existing.id,
            email,
            influencer_id,
        )
    return existing


async def _get_approval_audio_keys(pre_id: int, influencer_id: str) -> list[str]:
    keys = await pre_influencer_storage.list_audio_keys(str(pre_id))
    if keys:
        return keys

    keys = await list_influencer_audio_keys(str(pre_id))
    if keys:
        return keys

    return await list_influencer_audio_keys(influencer_id)


async def _prepare_approval_audio_keys(
    pre_id: int,
    influencer_id: str,
) -> list[str]:
    keys = await _get_approval_audio_keys(pre_id, influencer_id)
    prepared_keys: list[str] = []

    for key in keys:
        if pre_influencer_storage.is_audio_key_for_pre_influencer(str(pre_id), key):
            copied_key = await copy_pre_influencer_audio_to_influencer_audio(
                key,
                influencer_id,
            )
            prepared_keys.append(copied_key)
        else:
            prepared_keys.append(key)

    return prepared_keys


async def _notify_admin_pre_influencer_converted(
    db: AsyncSession,
    *,
    pre: PreInfluencer,
    influencer: Influencer,
) -> None:
    try:
        admin = await db.get(User, 1)
        admin_email = getattr(admin, "email", None)
        if not admin_email:
            log.info(
                "Skipping pre-influencer conversion admin email: admin user missing or has no email"
            )
            return

        await run_in_threadpool(
            send_pre_influencer_converted_admin_email,
            to_email=admin_email,
            pre_influencer_id=pre.id,
            influencer_id=str(influencer.id),
            display_name=influencer.display_name or pre.full_name or pre.username,
            creator_email=pre.email,
            publication_status=influencer.publication_status,
        )
    except Exception:
        log.exception(
            "Failed to send pre-influencer conversion admin email pre_id=%s influencer_id=%s",
            getattr(pre, "id", None),
            getattr(influencer, "id", None),
        )


async def approve_pre_influencer(db: AsyncSession, pre_id: int) -> dict:
    pre = await db.get(PreInfluencer, pre_id)
    if not pre:
        raise HTTPException(404, "PreInfluencer not found")

    if not pre.username:
        raise HTTPException(400, "PreInfluencer username missing")

    influencer_id = _normalize_influencer_id(pre.username.strip())
    if not influencer_id:
        raise HTTPException(400, "Invalid influencer id")

    influencer = await _resolve_influencer_for_approval(
        db,
        influencer_id=influencer_id,
        email=pre.email,
    )
    storage_influencer_id = influencer.id if influencer else influencer_id
    existing_voice_id = influencer.voice_id if influencer else None
    existing_agent_id = (
        influencer.influencer_agent_id_third_part if influencer else None
    )
    created_voice_id: str | None = None
    created_agent_id: str | None = None

    try:
        sections = await load_survey_questions(db)
        markdown = format_survey_markdown(
            sections, pre.survey_answers or {}, pre.username
        )
        prompt = await generate_prompt_from_markdown(
            markdown, additional_prompt=None, db=db
        )

        voice_id = influencer.voice_id if influencer else None
        agent_id = influencer.influencer_agent_id_third_part if influencer else None
        samples_meta = influencer.samples if influencer and influencer.samples else []
        display_name = (
            influencer.display_name
            if influencer and influencer.display_name
            else (pre.full_name or pre.username)
        )

        if voice_id:
            voice_exists = await _voices_gateway.voice_exists(voice_id)
            if not voice_exists:
                log.warning(
                    "Stale voice_id %s detected for %s, will recreate",
                    voice_id,
                    storage_influencer_id,
                )
                voice_id = None
                samples_meta = []
        if not voice_id:
            keys = await _prepare_approval_audio_keys(pre_id, storage_influencer_id)
            if not keys:
                raise HTTPException(
                    400,
                    "No audio samples found. Please upload voice samples before approving.",
                )

            multipart_files: list[tuple[str, tuple[str, bytes, str]]] = []
            new_samples_meta: list[dict] = []

            for key in keys:
                filename = key.split("/")[-1]
                content_type = mimetypes.guess_type(filename)[0] or "audio/mpeg"
                data = await get_s3_object_bytes(key)
                if not data:
                    continue
                multipart_files.append(("files", (filename, data, content_type)))
                new_samples_meta.append(
                    {
                        "s3_key": key,
                        "original_filename": filename,
                        "content_type": content_type,
                        "created_at": datetime.now(timezone.utc).isoformat(),
                    }
                )

            if multipart_files:
                try:
                    payload = await _voices_gateway.create_voice(
                        name=display_name or influencer_id,
                        description=None,
                        labels_str=None,
                        remove_background_noise=True,
                        multipart_files=multipart_files,
                    )
                    voice_id = payload["voice_id"]
                    created_voice_id = voice_id
                    samples_meta = new_samples_meta
                except HTTPException:
                    raise
                except Exception:
                    log.exception("Failed to create voice via ElevenLabsVoicesGateway")
                    raise HTTPException(
                        status_code=502,
                        detail="Failed to create voice due to an upstream error.",
                    )

        bio_payload: dict = prompt if isinstance(prompt, dict) else {}
        if not bio_payload and isinstance(prompt, str):
            try:
                parsed_prompt = json.loads(prompt)
                if isinstance(parsed_prompt, dict):
                    bio_payload = parsed_prompt
            except Exception:
                bio_payload = {}

        answers_for_bio = pre.survey_answers or {}
        if answers_for_bio.get("q4_country") and not bio_payload.get("country"):
            bio_payload["country"] = answers_for_bio["q4_country"]
        languages: list[str] = []
        if answers_for_bio.get("q5_main_language"):
            languages.append(answers_for_bio["q5_main_language"])
        if answers_for_bio.get("q6_secondary_language"):
            languages.append(answers_for_bio["q6_secondary_language"])
        if languages and not bio_payload.get("languages"):
            bio_payload["languages"] = languages
        bio_payload.setdefault("social_links", [])

        personality_prompt = (
            bio_payload.get("personality_rules")
            if isinstance(bio_payload.get("personality_rules"), str)
            else ""
        )

        agent_id = await _agents_gateway.upsert_agent_prompt(
            agent_id=agent_id,
            prompt_text=personality_prompt,
            voice_id=voice_id,
            agent_name=display_name or influencer_id,
        )
        if agent_id and agent_id != existing_agent_id:
            created_agent_id = agent_id

        if not pre.fp_promoter_id:
            try:
                first = (pre.full_name or pre.username or "Influencer").split(" ")[0]
                last = " ".join((pre.full_name or "").split(" ")[1:]) or "TeaseMe"

                parent_promoter_id = None
                answers_meta = (pre.survey_answers or {}).get("__meta") or {}
                parent_ref_id = answers_meta.get("parent_ref_id")
                if parent_ref_id:
                    parent_promoter_id = await fp_find_promoter_id_by_ref_token(
                        parent_ref_id
                    )

                promoter = await fp_create_promoter(
                    email=pre.email,
                    first_name=first,
                    last_name=last,
                    cust_id=f"preinf-{pre.id}",
                    username=pre.username,
                    parent_promoter_id=parent_promoter_id,
                )
                if promoter:
                    pre.fp_promoter_id = str(promoter.get("id"))
                    pre.fp_ref_id = promoter.get("default_ref_id") or (
                        promoter.get("promotions") or [{}]
                    )[0].get("ref_id")
                    log.info(
                        "FP promoter created on approval id=%s ref_id=%s",
                        pre.fp_promoter_id,
                        pre.fp_ref_id,
                    )
            except Exception:
                log.exception(
                    "MJFP create promoter failed on approval for pre_id=%s",
                    pre.id,
                )

        if not influencer:
            influencer = Influencer(
                id=influencer_id,
                prompt_template=personality_prompt,
                display_name=display_name,
                bio_json=bio_payload,
                voice_id=voice_id,
                publication_status=InfluencerPublicationStatus.DRAFT.value,
                fp_promoter_id=pre.fp_promoter_id,
                fp_ref_id=pre.fp_ref_id,
                email=pre.email,
                influencer_agent_id_third_part=agent_id,
                samples=samples_meta,
            )
            db.add(influencer)
        else:
            if not influencer.display_name:
                influencer.display_name = display_name

            influencer.bio_json = bio_payload
            influencer.prompt_template = personality_prompt
            influencer.voice_id = voice_id
            influencer.influencer_agent_id_third_part = agent_id
            influencer.samples = samples_meta
            influencer.fp_promoter_id = pre.fp_promoter_id
            influencer.fp_ref_id = pre.fp_ref_id
            influencer.publication_status = InfluencerPublicationStatus.DRAFT.value
            db.add(influencer)

        answers = pre.survey_answers or {}
        photo_key = answers.get("profile_picture_key")
        if photo_key and not influencer.profile_photo_key:
            influencer.profile_photo_key = photo_key

        pre.status = "approved"
        db.add(pre)

        await db.commit()
        await db.refresh(influencer)
        schedule_mjfp_pre_influencer_step_webhook(pre.id)
        await _notify_admin_pre_influencer_converted(
            db,
            pre=pre,
            influencer=influencer,
        )

        return {
            "ok": True,
            "influencer_id": influencer.id,
            "fp_ref_id": influencer.fp_ref_id,
            "fp_promoter_id": influencer.fp_promoter_id,
        }
    except Exception:
        try:
            await db.rollback()
        except Exception:
            log.warning(
                "Failed to rollback DB transaction for influencer=%s",
                influencer_id,
                exc_info=True,
            )

        if created_agent_id:
            try:
                await _agents_gateway.delete_agent(created_agent_id)
                log.info(
                    "Cleanup: deleted newly created ElevenLabs agent %s",
                    created_agent_id,
                )
            except Exception:
                log.warning(
                    "Cleanup failed for agent_id=%s", created_agent_id, exc_info=True
                )

        if created_voice_id and created_voice_id != existing_voice_id:
            try:
                await _voices_gateway.delete_voice(created_voice_id)
                log.info(
                    "Cleanup: deleted newly created ElevenLabs voice %s",
                    created_voice_id,
                )
            except Exception:
                log.warning(
                    "Cleanup failed for voice_id=%s", created_voice_id, exc_info=True
                )

        raise
