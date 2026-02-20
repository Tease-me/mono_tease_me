import asyncio
from httpx import AsyncClient

payload = {
    "type": "conversation_initiated",
    "data": {
        "conversation_id": "conv_0701khjrb5yten08yayyjkfea9ww",
        "status": "done",
        "user_id": 1,
        "metadata": {
            "start_time_unix_secs": 1708400000,
            "call_duration_secs": 120
        },
        "transcript": [
            {"time_in_call_secs": 10, "text": "hello", "role": "user"},
            {"time_in_call_secs": 118, "text": "goodbye", "role": "ai"}
        ]
    }
}

async def test_webhook():
    async with AsyncClient(verify=False) as client:
        resp = await client.post("https://localhost:8000/webhooks/elevenlabs", json=payload)
        print(f"Status: {resp.status_code}")
        print(f"Response: {resp.json()}")

if __name__ == "__main__":
    asyncio.run(test_webhook())
