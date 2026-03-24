import json
from pywebpush import webpush, WebPushException
from sqlalchemy import delete

from app.data.models import Subscription
from app.core.session import SessionLocal
from app.core.config import settings

VAPID_PUBLIC_KEY = settings.VAPID_PUBLIC_KEY
VAPID_PRIVATE_KEY = settings.VAPID_PRIVATE_KEY
VAPID_EMAIL = settings.VAPID_EMAIL or "mailto:admin@example.com"

async def _handle_push_error(e: WebPushException, subscription: Subscription):
    status = getattr(e.response, "status_code", None)
    if status in (403, 404, 410):
        print(f"[push] ❌ Subscription {subscription.id} invalid (status {status}), removing...")
        try:
            async with SessionLocal() as db:
                stmt = delete(Subscription).where(Subscription.id == subscription.id)
                await db.execute(stmt)
                await db.commit()
            print(f"[push] ✅ Invalid subscription {subscription.id} removed.")
        except Exception as db_err:
            print(f"[push] ❌ Failed to remove subscription {subscription.id}: {db_err}")
    else:
        print(f"[push] ❌ Error sending notification: {e}")


async def send_push(subscription: Subscription, message: str = "Oi! 🥰"):
    try:
        webpush(
            subscription_info=subscription.subscription_json,
            data=json.dumps({"message": message}),
            vapid_private_key=VAPID_PRIVATE_KEY,
            vapid_claims={"sub": VAPID_EMAIL}
        )
        print("[push] ✅ Notification sent successfully.")
    except WebPushException as e:
        await _handle_push_error(e, subscription)


async def send_push_rich(
    subscription: Subscription,
    title: str,
    body: str,
    image_url: str | None = None,
    action_url: str | None = None,
    influencer_id: str | None = None,
    badge_url: str | None = None,
):
    payload = {
        "title": title,
        "body": body,
        "tag": f"reengagement-{influencer_id}" if influencer_id else "reengagement",
    }

    if image_url:
        payload["image"] = image_url

    if action_url:
        payload["url"] = action_url
    elif influencer_id:
        payload["url"] = f"/chat/{influencer_id}"

    if badge_url:
        payload["badge"] = badge_url

    try:
        webpush(
            subscription_info=subscription.subscription_json,
            data=json.dumps(payload),
            vapid_private_key=VAPID_PRIVATE_KEY,
            vapid_claims={"sub": VAPID_EMAIL}
        )
        print(f"[push] ✅ Rich notification sent: {title}")
    except WebPushException as e:
        await _handle_push_error(e, subscription)
        # We also raise it here since it originally did, though we may reconsider
        # if the caller fails, it's better to let them know
        raise