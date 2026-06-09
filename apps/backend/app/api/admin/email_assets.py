from fastapi import APIRouter, Depends, File, UploadFile

from app.api.admin.common import ensure_admin
from app.data.models import User
from app.data.schemas.admin import AdminEmailAssetOut
from app.services.use_cases.admin_email_assets import (
    get_admin_email_assets,
    upload_admin_reset_password_header,
)
from app.utils.auth.dependencies import get_current_user

router = APIRouter(tags=["Admin Email Assets"])


@router.get(
    "/email-assets",
    response_model=AdminEmailAssetOut,
    summary="Get password reset email asset",
    description="Return the admin-managed password reset email header asset metadata.",
)
async def get_email_assets(
    current_user: User = Depends(get_current_user),
):
    ensure_admin(current_user)
    return await get_admin_email_assets()


@router.post(
    "/email-assets",
    response_model=AdminEmailAssetOut,
    summary="Upload password reset email asset",
    description="Upload the admin-managed password reset email header asset.",
)
async def post_email_assets(
    reset_password_header: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
):
    ensure_admin(current_user)
    return await upload_admin_reset_password_header(reset_password_header)
