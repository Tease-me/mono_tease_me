from fastapi import HTTPException

from app.data.models import User


def ensure_admin(current_user: User) -> None:
    if current_user.id != 1:
        raise HTTPException(status_code=403, detail="Admin only")

