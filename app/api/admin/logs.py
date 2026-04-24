import logging
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import FileResponse, StreamingResponse

from app.api.admin.common import ensure_admin
from app.data.models import User
from app.services.use_cases.admin_logs import (
    AdminLogsAccessError,
    AdminLogsValidationError,
    get_log_download,
    get_log_files,
    get_logs_page,
    stream_logs_sse,
)
from app.utils.auth.dependencies import get_current_user

router = APIRouter(tags=["Admin Logs"])
log = logging.getLogger(__name__)


@router.get(
    "/logs",
    summary="List application logs",
    description="Return a filtered page of application log entries for admin inspection.",
)
async def get_admin_logs(
    q: str | None = None,
    level: str | None = None,
    file: str | None = None,
    limit: int = 200,
    cursor: str | None = None,
    direction: Literal["backward", "forward"] = "backward",
    current_user: User = Depends(get_current_user),
):
    ensure_admin(current_user)
    try:
        result = get_logs_page(
            q=q,
            level=level,
            file=file,
            limit=limit,
            cursor=cursor,
            direction=direction,
        )
    except AdminLogsValidationError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except AdminLogsAccessError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    except Exception:
        raise HTTPException(status_code=500, detail="Failed to fetch logs")
    return result.as_dict()


@router.get(
    "/logs/files",
    summary="List log files",
    description="Return the available log files that admins can inspect or download.",
)
async def get_admin_logs_files(current_user: User = Depends(get_current_user)):
    ensure_admin(current_user)
    try:
        result = get_log_files()
    except Exception:
        raise HTTPException(status_code=500, detail="Failed to fetch log files")
    return result.as_dict()


@router.get(
    "/logs/download",
    summary="Download one log file",
    description="Download a specific log file from the server.",
)
async def download_admin_log_file(file: str, current_user: User = Depends(get_current_user)):
    ensure_admin(current_user)
    try:
        result = get_log_download(file)
    except AdminLogsValidationError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except AdminLogsAccessError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    except Exception:
        raise HTTPException(status_code=500, detail="Failed to download log file")

    return FileResponse(
        path=str(result.file_path),
        filename=result.file_name,
        media_type="text/plain; charset=utf-8",
    )


@router.get(
    "/logs/stream",
    summary="Stream logs",
    description="Open a server-sent events stream of application logs for live admin monitoring.",
)
async def stream_admin_logs(
    request: Request,
    q: str | None = None,
    level: str | None = None,
    file: str | None = None,
    poll_interval_ms: int = 1500,
    current_user: User = Depends(get_current_user),
):
    ensure_admin(current_user)
    try:
        source = stream_logs_sse(
            q=q,
            level=level,
            file=file,
            poll_interval_ms=poll_interval_ms,
        )
    except AdminLogsValidationError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except AdminLogsAccessError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    except Exception:
        raise HTTPException(status_code=500, detail="Failed to stream logs")

    async def event_stream():
        try:
            async for chunk in source:
                if await request.is_disconnected():
                    break
                yield chunk
        finally:
            await source.aclose()

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )
