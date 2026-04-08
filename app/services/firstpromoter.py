import asyncio
import httpx
import logging

from app.core.config import settings

log = logging.getLogger(__name__)


def _seed_mjfp_config() -> None:
    """Seed MJFPConfig from app settings (idempotent)."""
    from app.services.mjpromoter import MJFPConfig

    if MJFPConfig.MJFP_API_URL is None:
        MJFPConfig.MJFP_API_URL = settings.MJFP_API_URL
    if MJFPConfig.MJFP_API_KEY is None:
        MJFPConfig.MJFP_API_KEY = settings.MJFP_API_KEY
    if MJFPConfig.MJFP_TOKEN is None:
        MJFPConfig.MJFP_TOKEN = settings.MJFP_TOKEN
    if MJFPConfig.MJFP_ACCOUNT_ID is None:
        MJFPConfig.MJFP_ACCOUNT_ID = settings.MJFP_ACCOUNT_ID


def _fp_unwrap(payload: dict | None) -> dict | None:
    if not payload or not isinstance(payload, dict):
        return None
    data = payload.get("data")
    if isinstance(data, dict):
        return data
    return payload


def fp_extract_email(payload: dict | None) -> str | None:
    data = _fp_unwrap(payload)
    if not data:
        return None
    email = data.get("email")
    return str(email) if email else None


def fp_extract_parent_promoter_id(payload: dict | None) -> int | None:
    data = _fp_unwrap(payload)
    if not data:
        return None
    for key in ("parent_promoter_id", "parent_id"):
        val = data.get(key)
        if val is not None and str(val).isdigit():
            return int(val)
    parent = data.get("parent_promoter") or data.get("parent")
    if isinstance(parent, dict):
        val = parent.get("id")
        if val is not None and str(val).isdigit():
            return int(val)
    return None


async def fp_get_promoter_v2(promoter_id: int | str) -> dict | None:
    token = settings.FIRSTPROMOTER_TOKEN
    account_id = settings.FIRSTPROMOTER_ACCOUNT_ID
    if not token or not account_id:
        return None

    async with httpx.AsyncClient(timeout=20) as client:
        r = await client.get(
            f"{settings.FIRSTPROMOTER_COMPANY_API_BASE_URL}/company/promoters/{promoter_id}",
            headers={
                "Authorization": f"Bearer {token}",
                "Account-ID": account_id,
            },
        )
        if r.status_code == 404:
            return None
        if r.status_code >= 400:
            log.error("FP get promoter failed: %s %s id=%s", r.status_code, r.text, promoter_id)
        r.raise_for_status()
        return r.json()


async def fp_track_sale_v2(
    *,
    email: str | None,
    uid: str | None,
    amount_cents: int,
    event_id: str,
    tid: str | None = None,
    ref_id: str | None = None,
    plan: str | None = None,
) -> dict | None:
    _seed_mjfp_config()
    from app.services.mjpromoter import fp_track_sale_v2 as _mjfp_track_sale_v2

    payload: dict = {
        "event_id": event_id,
        "amount": int(amount_cents),
    }
    if email:
        payload["email"] = email
    if uid:
        payload["uid"] = uid
    if tid:
        payload["tid"] = tid
    if ref_id:
        payload["ref_id"] = ref_id
    if plan:
        payload["plan"] = plan

    async def _fp_call() -> dict | None:
        token = settings.FIRSTPROMOTER_TOKEN
        account_id = settings.FIRSTPROMOTER_ACCOUNT_ID
        if not token or not account_id:
            return None
        async with httpx.AsyncClient(timeout=20) as client:
            r = await client.post(
                f"{settings.FIRSTPROMOTER_API_BASE_URL}/track/sale",
                json=payload,
                headers={
                    "Content-Type": "application/json",
                    "Authorization": f"Bearer {token}",
                    "Account-ID": account_id,
                },
            )
            r.raise_for_status()
            return r.json()

    results = await asyncio.gather(
        _fp_call(),
        _mjfp_track_sale_v2(
            email=email,
            uid=uid,
            amount_cents=amount_cents,
            event_id=event_id,
            tid=tid,
            ref_id=ref_id,
            plan=plan,
        ),
        return_exceptions=True,
    )
    if isinstance(results[0], Exception):
        raise results[0]
    if isinstance(results[1], Exception):
        log.warning("MJFP track sale failed for event_id=%s: %s", event_id, results[1])
    return results[0]


async def fp_track_signup(
    *,
    email: str | None,
    uid: str | None,
    tid: str | None,
) -> None:
    if not tid:
        return

    _seed_mjfp_config()
    from app.services.mjpromoter import fp_track_signup as _mjfp_track_signup

    payload: dict = {}
    if email:
        payload["email"] = email
    if uid:
        payload["uid"] = uid
    payload["tid"] = tid

    async def _fp_call() -> None:
        token = settings.FIRSTPROMOTER_TOKEN
        account_id = settings.FIRSTPROMOTER_ACCOUNT_ID
        if not token or not account_id:
            return
        async with httpx.AsyncClient(timeout=10) as client:
            r = await client.post(
                f"{settings.FIRSTPROMOTER_API_BASE_URL}/track/signup",
                json=payload,
                headers={
                    "Authorization": f"Bearer {token}",
                    "Account-ID": account_id,
                    "Content-Type": "application/json",
                },
            )
            r.raise_for_status()

    results = await asyncio.gather(
        _fp_call(),
        _mjfp_track_signup(email=email, uid=uid, tid=tid),
        return_exceptions=True,
    )
    if isinstance(results[0], Exception):
        raise results[0]
    if isinstance(results[1], Exception):
        log.warning("MJFP track signup failed for tid=%s: %s", tid, results[1])


async def fp_create_promoter(
    *,
    email: str,
    first_name: str,
    last_name: str,
    cust_id: str,
    username: str | None = None,
    parent_promoter_id: int | str | None = None,
    temp_password: str | None = None,
    paypal_email: str | None = None,
) -> dict | None:
    _seed_mjfp_config()
    from app.services.mjpromoter import fp_create_promoter as _mjfp_create_promoter

    fp_payload: dict = {
        "email": email,
        "first_name": first_name,
        "last_name": last_name,
        "cust_id": cust_id,
        "website": f"{settings.FRONTEND_URL.rstrip('/')}/join",
    }
    if parent_promoter_id:
        fp_payload["parent_promoter_id"] = int(parent_promoter_id) if str(parent_promoter_id).isdigit() else parent_promoter_id

    async def _fp_call() -> dict | None:
        api_key = settings.FIRSTPROMOTER_API_KEY
        if not api_key:
            return None
        async with httpx.AsyncClient(timeout=30) as client:
            r = await client.post(
                f"{settings.FIRSTPROMOTER_API_V1_BASE_URL}/promoters/create",
                json=fp_payload,
                headers={"X-API-KEY": api_key, "Content-Type": "application/json"},
            )
            if r.status_code >= 400:
                log.error("FP create promoter failed: %s %s payload=%s", r.status_code, r.text, fp_payload)
            r.raise_for_status()
            return r.json()

    results = await asyncio.gather(
        _fp_call(),
        _mjfp_create_promoter(
            email=email,
            first_name=first_name,
            last_name=last_name,
            cust_id=cust_id,
            username=username or cust_id,
            parent_promoter_id=str(parent_promoter_id) if parent_promoter_id else None,
            temp_password=temp_password,
            paypal_email=paypal_email,
        ),
        return_exceptions=True,
    )
    if isinstance(results[0], Exception):
        raise results[0]
    if isinstance(results[1], Exception):
        log.warning("MJFP create promoter failed for cust_id=%s: %s", cust_id, results[1])
    return results[0]


async def fp_track_refund(
    *,
    event_id: str,
    amount_cents: int,
    email: str | None = None,
    uid: str | None = None,
) -> dict | None:
    _seed_mjfp_config()
    from app.services.mjpromoter import fp_track_refund as _mjfp_track_refund

    payload: dict = {
        "event_id": event_id,
        "amount": int(amount_cents),
    }
    if email:
        payload["email"] = email
    if uid:
        payload["uid"] = uid

    async def _fp_call() -> dict | None:
        token = settings.FIRSTPROMOTER_TOKEN
        account_id = settings.FIRSTPROMOTER_ACCOUNT_ID
        if not token or not account_id:
            return None
        async with httpx.AsyncClient(timeout=20) as client:
            r = await client.post(
                f"{settings.FIRSTPROMOTER_API_BASE_URL}/track/refund",
                json=payload,
                headers={
                    "Content-Type": "application/json",
                    "Authorization": f"Bearer {token}",
                    "Account-ID": account_id,
                },
            )
            r.raise_for_status()
            return r.json()

    results = await asyncio.gather(
        _fp_call(),
        _mjfp_track_refund(event_id=event_id, amount_cents=amount_cents, email=email, uid=uid),
        return_exceptions=True,
    )
    if isinstance(results[0], Exception):
        raise results[0]
    if isinstance(results[1], Exception):
        log.warning("MJFP track refund failed for event_id=%s: %s", event_id, results[1])
    return results[0]


async def fp_find_promoter_id_by_ref_token(ref_token: str) -> int | None:
    token = settings.FIRSTPROMOTER_TOKEN
    account_id = settings.FIRSTPROMOTER_ACCOUNT_ID
    if not token or not account_id:
        return None

    async with httpx.AsyncClient(timeout=20) as client:
        r = await client.get(
            f"{settings.FIRSTPROMOTER_COMPANY_API_BASE_URL}/company/promoters",
            params={"search": ref_token},
            headers={
                "Authorization": f"Bearer {token}",
                "Account-ID": account_id,
            },
        )
        r.raise_for_status()
        data = r.json().get("data", [])

    for p in data:
        for pc in p.get("promoter_campaigns", []):
            if pc.get("ref_token") == ref_token:
                return int(p["id"])

    return None


async def fp_find_promoter_id_by_username(username: str) -> str | None:
    _seed_mjfp_config()
    from app.services.mjpromoter import fp_find_promoter_id_by_username as _mjfp_find_by_username
    return await _mjfp_find_by_username(username)
