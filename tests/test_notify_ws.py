from __future__ import annotations

import pytest

from app.api.routes.notify_ws import notification_sockets, notify_call_billed
from app.data.schemas.billing import AdultCharacterSummaryOut, LatestAdultCallSummaryOut


class DummyWebSocket:
    def __init__(self) -> None:
        self.sent_payloads: list[dict] = []

    async def send_json(self, payload: dict) -> None:
        self.sent_payloads.append(payload)


@pytest.mark.anyio
async def test_notify_call_billed_sends_adult_character_summary_payload() -> None:
    ws = DummyWebSocket()
    notification_sockets["user@example.com"] = ws

    try:
        await notify_call_billed(
            "user@example.com",
            summary=AdultCharacterSummaryOut(
                influencer_id="loli",
                balance_cents=2669,
                balance_credits=1601,
                estimated_remaining_call_seconds=1334,
                latest_adult_call_summary=LatestAdultCallSummaryOut(
                    duration_seconds=149.0,
                    cost_cents=160,
                    cost_credits=96,
                ),
            ),
        )
    finally:
        notification_sockets.pop("user@example.com", None)

    assert ws.sent_payloads == [
        {
            "type": "call_billed",
            "influencer_id": "loli",
            "balance_cents": 2669,
            "balance_credits": 1601,
            "estimated_remaining_call_seconds": 1334,
            "latest_adult_call_summary": {
                "duration_seconds": 149.0,
                "cost_cents": 160,
                "cost_credits": 96,
            },
        }
    ]
