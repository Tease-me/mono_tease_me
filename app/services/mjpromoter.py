"""
MJ First Promoter (MJFP) API Client
100% compatible with FirstPromoter API v1/v2

Drop-in replacement for your existing FirstPromoter integration.
"""

import httpx
import logging

log = logging.getLogger(__name__)


class MJFPConfig:
    """
    Configuration for MJ First Promoter API
    
    Set these values from your environment variables or configure programmatically:
    - MJFP_API_URL: API base URL (e.g., "http://localhost:5555/api" or production URL)
    - MJFP_API_KEY: V1 API key for promoter creation
    - MJFP_TOKEN: V2 API Bearer token for tracking
    - MJFP_ACCOUNT_ID: V2 API Account ID
    """
    MJFP_API_URL: str | None = None
    MJFP_API_KEY: str | None = None
    MJFP_TOKEN: str | None = None
    MJFP_ACCOUNT_ID: str | None = None
    
    @classmethod
    def log_config_status(cls):
        """Log current configuration status for debugging"""
        log.info("[MJFP] Configuration status:")
        log.info(f"[MJFP]   API_URL: {cls.MJFP_API_URL}")
        log.info(f"[MJFP]   API_KEY configured: {bool(cls.MJFP_API_KEY)}")
        log.info(f"[MJFP]   TOKEN configured: {bool(cls.MJFP_TOKEN)}")
        log.info(f"[MJFP]   ACCOUNT_ID: {cls.MJFP_ACCOUNT_ID}")


def _fp_unwrap(payload: dict | None) -> dict | None:
    """Unwrap FirstPromoter-style response (compatibility helper)"""
    if not payload or not isinstance(payload, dict):
        return None
    data = payload.get("data")
    if isinstance(data, dict):
        return data
    return payload


def fp_extract_email(payload: dict | None) -> str | None:
    """Extract email from response payload"""
    data = _fp_unwrap(payload)
    if not data:
        return None
    email = data.get("email")
    return str(email) if email else None


def fp_extract_parent_promoter_id(payload: dict | None) -> int | None:
    """Extract parent promoter ID from response payload"""
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
    """
    Get promoter details by ID
    
    Args:
        promoter_id: Promoter ID
        
    Returns:
        Promoter data or None if not found
    """
    log.info(f"[MJFP] Getting promoter: id={promoter_id}")
    token = MJFPConfig.MJFP_TOKEN
    account_id = MJFPConfig.MJFP_ACCOUNT_ID
    if not token or not account_id:
        log.error("[MJFP] Credentials not configured (token=%s, account_id=%s)", bool(token), bool(account_id))
        return None

    url = f"{MJFPConfig.MJFP_API_URL}/v2/company/promoters/{promoter_id}"
    log.debug(f"[MJFP] GET {url}")
    
    async with httpx.AsyncClient(timeout=20) as client:
        try:
            r = await client.get(
                url,
                headers={
                    "Authorization": f"Bearer {token}",
                    "Account-ID": account_id,
                },
            )
            log.debug(f"[MJFP] Response status: {r.status_code}, body: {r.text[:200]}")
            if r.status_code == 404:
                log.info(f"[MJFP] Promoter not found: id={promoter_id}")
                return None
            if r.status_code >= 400:
                log.error("[MJFP] Get promoter failed: status=%s body=%s id=%s", r.status_code, r.text, promoter_id)
                return None
            r.raise_for_status()
            result = r.json()
            log.info(f"[MJFP] ✅ Promoter retrieved: id={promoter_id}")
            return result
        except httpx.HTTPStatusError as e:
            log.error(f"[MJFP] Get promoter HTTP error for id={promoter_id}: {e.response.status_code} {e.response.text}")
            return None
        except Exception as e:
            log.error(f"[MJFP] Get promoter error for id={promoter_id}: {e}")
            return None


async def fp_track_sale_v2(
    *, 
    email: str | None = None, 
    uid: str | None = None, 
    amount_cents: int, 
    event_id: str, 
    tid: str | None = None, 
    ref_id: str | None = None, 
    plan: str | None = None
) -> dict | None:
    """
    Track a sale/conversion in MJ Promoter
    
    Args:
        email: Customer email (required if uid not provided)
        uid: Customer user ID (required if email not provided)
        amount_cents: Sale amount in CENTS (e.g., 5000 = $50.00)
        event_id: Unique transaction ID from your system
        tid: Tracking ID (optional)
        ref_id: Promoter's ref_id (optional, used for lookup)
        plan: Subscription plan name (optional)
        
    Returns:
        Response with commission details
    """
    log.info(f"[MJFP] Tracking sale: event_id={event_id}, amount=${amount_cents/100:.2f}, email={email}, uid={uid}, ref_id={ref_id}")
    token = MJFPConfig.MJFP_TOKEN
    account_id = MJFPConfig.MJFP_ACCOUNT_ID

    if not token or not account_id:
        log.error("[MJFP] Credentials not configured (token=%s, account_id=%s)", bool(token), bool(account_id))
        return None

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

    url = f"{MJFPConfig.MJFP_API_URL}/v2/track/sale"
    log.debug(f"[MJFP] POST {url} payload={payload}")

    async with httpx.AsyncClient(timeout=20) as client:
        try:
            r = await client.post(
                url,
                json=payload,
                headers={
                    "Content-Type": "application/json",
                    "Authorization": f"Bearer {token}",
                    "Account-ID": account_id,
                },
            )
            log.debug(f"[MJFP] Response status: {r.status_code}, body: {r.text[:200]}")
            
            if r.status_code == 404:
                try:
                    error_body = r.json()
                    error_msg = error_body.get("error", "Not found")
                    log.warning(f"[MJFP] Sale tracking failed: {error_msg} for event_id={event_id}, ref_id={ref_id}")
                except Exception:
                    log.error(f"[MJFP] Endpoint not found: {url}")
                return None
            
            if r.status_code >= 400:
                log.error(f"[MJFP] Track sale failed: status={r.status_code}, body={r.text}")
                return None
            
            r.raise_for_status()
            result = r.json()
            log.info(f"[MJFP] ✅ Sale tracked: {event_id} - ${amount_cents/100:.2f}")
            return result
        except httpx.HTTPStatusError as e:
            log.error(f"[MJFP] Track sale HTTP error for event_id={event_id}: {e.response.status_code} {e.response.text}")
            return None
        except Exception as e:
            log.error(f"[MJFP] Track sale error for event_id={event_id}: {e}")
            return None


async def fp_track_signup(
    *,
    email: str | None = None,
    uid: str | None = None,
    tid: str | None = None,
) -> dict | None:
    """
    Track a signup in MJ Promoter
    
    Args:
        email: User email (optional)
        uid: User ID (optional)
        tid: Tracking ID / ref_id (required)
        
    Returns:
        Response with referral details
    """
    log.info(f"[MJFP] Tracking signup: email={email}, uid={uid}, tid={tid}")
    
    if not tid:
        log.warning("[MJFP] Track signup skipped: tid is required but not provided")
        return None

    token = MJFPConfig.MJFP_TOKEN
    account_id = MJFPConfig.MJFP_ACCOUNT_ID

    if not token or not account_id:
        log.error("[MJFP] Credentials not configured (token=%s, account_id=%s)", bool(token), bool(account_id))
        return None

    payload = {"tid": tid}
    if email:
        payload["email"] = email
    if uid:
        payload["uid"] = uid

    url = f"{MJFPConfig.MJFP_API_URL}/v2/track/signup"
    log.debug(f"[MJFP] POST {url} payload={payload}")

    async with httpx.AsyncClient(timeout=10) as client:
        try:
            r = await client.post(
                url,
                json=payload,
                headers={
                    "Authorization": f"Bearer {token}",
                    "Account-ID": account_id,
                    "Content-Type": "application/json",
                },
            )
            log.debug(f"[MJFP] Response status: {r.status_code}, body: {r.text[:200]}")
            
            if r.status_code == 404:
                try:
                    error_body = r.json()
                    error_msg = error_body.get("error", "Not found")
                    if "tracking id" in error_msg.lower() or "ref" in error_msg.lower():
                        log.warning(f"[MJFP] Tracking ID not found in MJFP database: tid={tid}. User will not be tracked for referral.")
                        return None
                    else:
                        log.error(f"[MJFP] Endpoint not found: {url}. Error: {error_msg}")
                        return None
                except:
                    log.error(f"[MJFP] Endpoint not found: {url}")
                    return None
            
            if r.status_code >= 400:
                log.error(f"[MJFP] Track signup failed: status={r.status_code}, body={r.text}")
                return None
                
            r.raise_for_status()
            result = r.json()
            log.info(f"[MJFP] ✅ Signup tracked: {email or uid} -> {tid}")
            return result
        except httpx.HTTPStatusError as e:
            log.error(f"[MJFP] Track signup HTTP error for tid={tid}, email={email}, uid={uid}: {e.response.status_code} {e.response.text}")
            return None
        except Exception as e:
            log.error(f"[MJFP] Track signup error for tid={tid}, email={email}, uid={uid}: {e}")
            return None


async def fp_create_promoter(
    *, 
    email: str, 
    first_name: str, 
    last_name: str, 
    cust_id: str,
    username: str,
    parent_promoter_id: int | str | None = None,
    temp_password: str | None = None,
    paypal_email: str | None = None,
) -> dict | None:
    """
    Create a new promoter in MJ Promoter
    
    Args:
        email: Promoter email
        first_name: First name
        last_name: Last name
        cust_id: Your internal customer/influencer ID (e.g., "preinf-123")
        username: Username/invite code for the promoter
        parent_promoter_id: Parent promoter's ref_id for multi-level tracking
        temp_password: Initial password (optional, will be auto-generated)
        paypal_email: PayPal email for payouts (optional)
        
    Returns:
        Promoter data with ref_id
    """
    log.info(f"[MJFP] Creating promoter: email={email}, name={first_name} {last_name}, cust_id={cust_id}, username={username}, parent={parent_promoter_id}")
    api_key = MJFPConfig.MJFP_API_KEY
    if not api_key:
        log.error("[MJFP] API key not configured")
        return None

    payload = {
        "email": email,
        "first_name": first_name,
        "last_name": last_name,
        "cust_id": cust_id,
        "username": username,
    }
    
    if parent_promoter_id:
        payload["parent_promoter_id"] = str(parent_promoter_id)
    
    if temp_password:
        payload["temp_password"] = temp_password
        
    if paypal_email:
        payload["paypal_email"] = paypal_email

    url = f"{MJFPConfig.MJFP_API_URL}/v1/promoters/create"
    log.debug(f"[MJFP] POST {url} payload={payload}")

    async with httpx.AsyncClient(timeout=30) as client:
        try:
            r = await client.post(
                url,
                json=payload,
                headers={
                    "X-API-KEY": api_key, 
                    "Content-Type": "application/json"
                },
            )

            log.debug(f"[MJFP] Response status: {r.status_code}, body: {r.text[:200]}")
            
            if r.status_code == 404:
                try:
                    error_body = r.json()
                    error_msg = error_body.get("error", "Not found")
                    log.error(f"[MJFP] Create promoter endpoint issue: {error_msg}")
                except:
                    log.error(f"[MJFP] Endpoint not found: {url}")
                return None
            
            if r.status_code == 409:
                log.warning(f"[MJFP] Promoter already exists: email={email}, cust_id={cust_id}")
                try:
                    return r.json()
                except:
                    return None
            
            if r.status_code >= 400:
                log.error("[MJFP] Create promoter failed: status=%s body=%s payload=%s", r.status_code, r.text, payload)
                return None

            r.raise_for_status()
            result = r.json()
            log.info(f"[MJFP] ✅ Promoter created: {email} (ref_id: {result.get('ref_id')}, id: {result.get('id')})")
            return result
        except httpx.HTTPStatusError as e:
            log.error(f"[MJFP] Create promoter HTTP error for email={email}: {e.response.status_code} {e.response.text}")
            return None
        except Exception as e:
            log.error(f"[MJFP] Create promoter error for email={email}: {e}")
            return None


async def fp_track_refund(
    *,
    event_id: str,
    amount_cents: int,
    email: str | None = None,
    uid: str | None = None,
) -> dict | None:
    """
    Track a refund in MJ Promoter (reverses commissions)
    
    Args:
        event_id: Original transaction event_id
        amount_cents: Refunded amount in CENTS
        email: Customer email (optional)
        uid: Customer user ID (optional)
        
    Returns:
        Response confirming refund processed
    """
    log.info(f"[MJFP] Tracking refund: event_id={event_id}, amount=${amount_cents/100:.2f}, email={email}, uid={uid}")
    token = MJFPConfig.MJFP_TOKEN
    account_id = MJFPConfig.MJFP_ACCOUNT_ID

    if not token or not account_id:
        log.error("[MJFP] Credentials not configured (token=%s, account_id=%s)", bool(token), bool(account_id))
        return None

    payload: dict = {
        "event_id": event_id,
        "amount": int(amount_cents),
    }
    if email:
        payload["email"] = email
    if uid:
        payload["uid"] = uid

    url = f"{MJFPConfig.MJFP_API_URL}/v2/track/refund"
    log.debug(f"[MJFP] POST {url} payload={payload}")

    async with httpx.AsyncClient(timeout=20) as client:
        try:
            r = await client.post(
                url,
                json=payload,
                headers={
                    "Content-Type": "application/json",
                    "Authorization": f"Bearer {token}",
                    "Account-ID": account_id,
                },
            )
            log.debug(f"[MJFP] Response status: {r.status_code}, body: {r.text[:200]}")
            
            if r.status_code == 404:
                try:
                    error_body = r.json()
                    error_msg = error_body.get("error", "Not found")
                    log.warning(f"[MJFP] Refund tracking failed: {error_msg} for event_id={event_id}")
                except:
                    log.error(f"[MJFP] Endpoint not found: {url}")
                return None
            
            if r.status_code >= 400:
                log.error(f"[MJFP] Track refund failed: status={r.status_code}, body={r.text}")
                return None
            
            r.raise_for_status()
            result = r.json()
            log.info(f"[MJFP] ✅ Refund tracked: {event_id} - ${amount_cents/100:.2f}")
            return result
        except httpx.HTTPStatusError as e:
            log.error(f"[MJFP] Track refund HTTP error for event_id={event_id}: {e.response.status_code} {e.response.text}")
            return None
        except Exception as e:
            log.error(f"[MJFP] Track refund error for event_id={event_id}: {e}")
            return None


async def fp_find_promoter_id_by_ref_token(ref_token: str) -> str | None:
    """
    Find promoter ID by their ref_token (ref_id/inviteCode)
    
    Args:
        ref_token: Promoter's unique reference code
        
    Returns:
        Promoter ID or None if not found
    """
    log.info(f"[MJFP] Finding promoter by ref_token: {ref_token}")
    token = MJFPConfig.MJFP_TOKEN
    account_id = MJFPConfig.MJFP_ACCOUNT_ID
    if not token or not account_id:
        log.error("[MJFP] Credentials not configured (token=%s, account_id=%s)", bool(token), bool(account_id))
        return None

    url = f"{MJFPConfig.MJFP_API_URL}/v2/company/promoters"
    log.debug(f"[MJFP] GET {url}?search={ref_token}")

    async with httpx.AsyncClient(timeout=20) as client:
        try:
            r = await client.get(
                url,
                params={"search": ref_token},
                headers={
                    "Authorization": f"Bearer {token}",
                    "Account-ID": account_id,
                },
            )
            
            log.debug(f"[MJFP] Response status: {r.status_code}, body: {r.text[:200]}")
            if r.status_code == 404:
                try:
                    error_body = r.json()
                    error_msg = error_body.get("error", "Not found")
                    log.info(f"[MJFP] Promoter not found for ref_token={ref_token}: {error_msg}")
                except:
                    log.info(f"[MJFP] Promoter not found for ref_token: {ref_token}")
                return None
            
            if r.status_code >= 400:
                log.error(f"[MJFP] Find promoter failed: status={r.status_code}, body={r.text}")
                return None
                
            r.raise_for_status()
            data = r.json()
            
            # MJ Promoter returns the promoter directly
            if data and isinstance(data, dict):
                promoter_id = data.get("id")
                log.info(f"[MJFP] ✅ Found promoter: ref_token={ref_token} -> id={promoter_id}")
                return promoter_id
            
            log.warning(f"[MJFP] No promoter found for ref_token: {ref_token}")
            return None
        except httpx.HTTPStatusError as e:
            log.error(f"[MJFP] Find promoter HTTP error for ref_token={ref_token}: {e.response.status_code} {e.response.text}")
            return None
        except Exception as e:
            log.error(f"[MJFP] Find promoter error for ref_token={ref_token}: {e}")
            return None


async def fp_find_promoter_id_by_username(username: str) -> str | None:
    """
    Find promoter ID by their username
    
    Args:
        username: Promoter's username/invite code
        
    Returns:
        Promoter ID or None if not found
    """
    log.info(f"[MJFP] Finding promoter by username: {username}")
    token = MJFPConfig.MJFP_TOKEN
    account_id = MJFPConfig.MJFP_ACCOUNT_ID
    if not token or not account_id:
        log.error("[MJFP] Credentials not configured (token=%s, account_id=%s)", bool(token), bool(account_id))
        return None

    url = f"{MJFPConfig.MJFP_API_URL}/v2/company/promoters"
    log.debug(f"[MJFP] GET {url}?username={username}")

    async with httpx.AsyncClient(timeout=20) as client:
        try:
            r = await client.get(
                url,
                params={"username": username},
                headers={
                    "Authorization": f"Bearer {token}",
                    "Account-ID": account_id,
                },
            )
            
            log.debug(f"[MJFP] Response status: {r.status_code}, body: {r.text[:200]}")
            if r.status_code == 404:
                try:
                    error_body = r.json()
                    error_msg = error_body.get("error", "Not found")
                    log.info(f"[MJFP] Promoter not found for username={username}: {error_msg}")
                except:
                    log.info(f"[MJFP] Promoter not found for username: {username}")
                return None
            
            if r.status_code >= 400:
                log.error(f"[MJFP] Find promoter failed: status={r.status_code}, body={r.text}")
                return None
                
            r.raise_for_status()
            data = r.json()
            
            # MJ Promoter returns the promoter directly
            if data and isinstance(data, dict):
                promoter_id = data.get("id")
                log.info(f"[MJFP] ✅ Found promoter: username={username} -> id={promoter_id}")
                return promoter_id
            
            log.warning(f"[MJFP] No promoter found for username: {username}")
            return None
        except httpx.HTTPStatusError as e:
            log.error(f"[MJFP] Find promoter HTTP error for username={username}: {e.response.status_code} {e.response.text}")
            return None
        except Exception as e:
            log.error(f"[MJFP] Find promoter error for username={username}: {e}")
            return None


# ============================================================================
# USAGE EXAMPLES
# ============================================================================

"""
# 1. Configure in your settings.py or config.py:
from mjfp import MJFPConfig

# Development
MJFPConfig.MJFP_API_URL = "http://localhost:5555/api"

# Production
MJFPConfig.MJFP_API_URL = "https://promoter.yourdomain.com/api"

# Set credentials (from environment variables)
MJFPConfig.MJFP_API_KEY = os.getenv("MJFP_API_KEY")
MJFPConfig.MJFP_TOKEN = os.getenv("MJFP_TOKEN")
MJFPConfig.MJFP_ACCOUNT_ID = os.getenv("MJFP_ACCOUNT_ID")


# 2. Create a promoter (exactly like FirstPromoter):
from mjfp import fp_create_promoter

promoter = await fp_create_promoter(
    email=pre.email,
    first_name=first,
    last_name=last,
    cust_id=f"preinf-{pre.id}",
    username=pre.username,
    parent_promoter_id=parent_promoter_id,  # Optional: parent's ref_id
)

# Returns:
# {
#   "id": "cmml946th00004c171d4othnn",
#   "email": "maria@teaseme.com",
#   "ref_id": "ywvliseOZ7",
#   "cust_id": "preinf-999",
#   "parent_promoter_id": "WryiVbz5sk",
#   "created_at": "2026-03-10T23:38:43.205Z"
# }


# 3. Track a sale when payment is processed:
from mjfp import fp_track_sale_v2

# In your PayPal webhook or payment processing:
async def process_payment(topup_record):
    if not topup_record['fp_tracked']:
        # Get influencer's ref_id from your database
        influencer_ref_id = topup_record['influencer_id']  # This should be the ref_id
        
        result = await fp_track_sale_v2(
            email=topup_record['user_email'],
            amount_cents=int(topup_record['amount'] * 100),  # Convert to cents!
            event_id=topup_record['transaction_id'],
            ref_id=influencer_ref_id,
            plan=topup_record.get('plan_name', 'topup')
        )
        
        if result and result.get('success'):
            # Mark as tracked in your database
            await mark_topup_as_tracked(topup_record['id'])
            log.info(f"✅ Commission created: {result['commissions']}")


# 4. Track signup (when user registers via referral link):
from mjfp import fp_track_signup

await fp_track_signup(
    email="newuser@example.com",
    uid="user_12345",
    tid="ywvliseOZ7"  # The ref_id from referral link
)


# 5. Track refund (when payment is refunded):
from mjfp import fp_track_refund

await fp_track_refund(
    event_id="tx_12345",  # Original transaction ID
    amount_cents=5000,    # Refunded amount in cents
    email="customer@example.com"
)


# 6. Find promoter by ref_token:
from mjfp import fp_find_promoter_id_by_ref_token

promoter_id = await fp_find_promoter_id_by_ref_token("ywvliseOZ7")
if promoter_id:
    print(f"Found promoter: {promoter_id}")


# 6b. Find promoter by username (for user-friendly invite codes):
from mjfp import fp_find_promoter_id_by_username

promoter_id = await fp_find_promoter_id_by_username("maria123")
if promoter_id:
    print(f"Found promoter by username: {promoter_id}")


# 7. Get promoter details:
from mjfp import fp_get_promoter_v2

promoter = await fp_get_promoter_v2(promoter_id="cmml946th00004c171d4othnn")
if promoter:
    print(f"Promoter: {promoter['email']}")
    print(f"Total earnings: ${promoter['stats']['total_earnings']:.2f}")
    print(f"Total referrals: {promoter['stats']['total_referrals']}")
"""
