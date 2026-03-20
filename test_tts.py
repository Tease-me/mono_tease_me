import asyncio
import audioop
from app.telegram.audio_bridge import elevenlabs_tts_to_pcm

async def main():
    voice_id = "EXAVITQu4vr4xnSDxMaL"
    text = "Hey! Oh my god, hi! I'm so happy you called me!"
    pcm = await elevenlabs_tts_to_pcm(text, voice_id)
    if pcm:
        rms = audioop.rms(pcm, 2)
        print(f"PCM size: {len(pcm)}, RMS volume: {rms}")
        # Let's also check if it's just all zeros
        non_zero_bytes = len([b for b in pcm if b != 0])
        print(f"Non-zero bytes: {non_zero_bytes}/{len(pcm)}")

if __name__ == "__main__":
    asyncio.run(main())
