from fastapi.encoders import jsonable_encoder

from app.data.models.influencer import PreInfluencer
from app.data.schemas.pre_influencer import PreInfluencerAdminOut
from app.utils.storage.s3 import generate_presigned_url


def build_pre_influencer_admin_out(pre: PreInfluencer) -> PreInfluencerAdminOut:
    data = jsonable_encoder(pre)
    answers = data.get("survey_answers") or {}
    key = answers.get("profile_picture_key")
    if key:
        answers["profile_picture_url"] = generate_presigned_url(key, expires=3600)
    data["survey_answers"] = answers
    return PreInfluencerAdminOut.model_validate(data)
