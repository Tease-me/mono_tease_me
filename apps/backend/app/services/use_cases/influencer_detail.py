from app.data.models import Influencer
from app.data.schemas.influencer import InfluencerDetail
from app.utils.storage.s3 import generate_presigned_url, get_influencer_profile_from_s3


async def build_influencer_detail(influencer: Influencer) -> InfluencerDetail:
    profile_json = await get_influencer_profile_from_s3(influencer.id)
    photo_url = (
        generate_presigned_url(influencer.profile_photo_key)
        if influencer.profile_photo_key
        else None
    )
    video_url = (
        generate_presigned_url(influencer.profile_video_key)
        if influencer.profile_video_key
        else None
    )

    about_text = profile_json.get("about") if isinstance(profile_json, dict) else None
    detail = InfluencerDetail.model_validate(influencer)
    detail.about = about_text
    detail.photo_url = photo_url
    detail.video_url = video_url
    return detail
