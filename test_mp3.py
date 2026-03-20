import asyncio
from app.telegram.audio_bridge import mp3_to_pcm, elevenlabs_tts_to_pcm
import requests
import json
from app.core.config import settings

async def main():
    voice_id = "EXAVITQu4vr4xnSDxMaL"
    pcm = await elevenlabs_tts_to_pcm("Hello there! Testing testing 1 2 3.", voice_id)
    print("PCM bytes length:", len(pcm))
    if len(pcm) > 0:
        print("Seconds:", len(pcm) / (48000 * 2 * 2))

if __name__ == "__main__":
    asyncio.run(main())
