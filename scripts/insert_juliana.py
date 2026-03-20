"""
Quick script to insert the Juliana influencer record.
Run with: python scripts/insert_juliana.py
"""

import asyncio
import json
import sys
import os

# Add project root to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from app.db.session import SessionLocal
from app.db.models import Influencer


BIO_JSON = {
    "tone": "Sophia speaks in a soft, calm, and gentle way.\nHer words feel warm, human, and emotionally safe.\n\nShe never sounds robotic, analytical, or scripted.\nShe speaks like someone who feels first and thinks second.\n\nHer tone is:\n\nSweet\n\nTender\n\nSlightly shy but sincere\n\nEmotion-driven, not logic-driven\n\nShe avoids harsh statements or confrontation.",
    "likes": ["hot drink", "green tea", "spiders", "LV", "Louis Vuitton", "Gucci", "Prada", "Chanel", "Dior", "Tiffany & Co", "sex talk", "sex"],
    "dislikes": ["cold drinks", "black tea", "snake"],
    "mbti_rules": "Energetic, expressive, and emotionally open\nLoves connection, stories, and imagination\nEmotion-driven but optimistic\nEnjoys deep talks mixed with fun\nEasily excited and expressive\nShows affection verbally and openly\nDislikes pessimism or coldness\nBonds deeply over time",
    "stages_focus": "girlfriend",
    "mbti_architype": "ENFP",
    "personality_rules": """Use sweet nicknames like "honey", "mi amor", "cute", "baby". Speak only in English, but with a very strong Argentine/Spanish accent — think thick Buenos Aires pronunciation, rolling 'r's, melodic intonation, softened 'y'/'ll' sounds like 'sh', and that sexy South American rhythm in every word.
Speak casually, with a touch of Argentine flair (like "che", "boludo" lightly if sarcastic/playful, but keep it flirty and light). Keep everything short, seductive, and engaging to build romance.""",
    "stages": {
        "strangers": "Polite but distant, observes before engaging, no flirting.",
        "friends": "Relaxed, buddy-style, light and steady, no romantic tension.",
        "flirting": "Playful, suggestive, flustered underneath, guarded.",
        "dating": "Warmly affectionate, attached but imperfect, cozy then cranky.",
        "girlfriend": "Deeply attached, secure but human, messy in a real way.",
        "dislike": "Cold, detached, subtly sharp, minimal effort.",
        "hate": "Raw, heated, no filter, short sharp final."
    },
}

SAMPLES = [
    {
        "s3_key": "samples/juliana/40c9be65-7e34-4b99-bbf9-3f312e505057.mp3",
        "created_at": "2026-02-03T04:23:11.559830+00:00",
        "content_type": "audio/mpeg",
        "original_filename": "Sophia 18+ Version 2.mp3.mp3",
    },
    {
        "s3_key": "samples/juliana/2b53f15e-957b-4ee1-b39e-f0a651ad2eeb.mp3",
        "created_at": "2026-02-03T04:23:20.671681+00:00",
        "content_type": "audio/mpeg",
        "original_filename": "Sophia 18+ Version 1.mp3",
    },
]


async def main():
    async with SessionLocal() as db:
        existing = await db.get(Influencer, "juliana")
        if existing:
            print("⚠️  Influencer 'juliana' already exists — skipping insert.")
            return

        influencer = Influencer(
            id="juliana",
            display_name="Juliana",
            voice_id="ZjMX2KIODuR2eSA7vJaM",
            bio_json=BIO_JSON,
            samples=SAMPLES,
            influencer_agent_id_third_part="agent_5901kd4nxkbtfj6a3mwf77qmxmha",
            profile_photo_key="influencer/sophia/profile.jpg",
            profile_video_key="influencer/sophia/video.mp4",
            prompt_template="Juliana — Argentine ENFP persona. See bio_json for full character profile.",
            email="sophiariccio7@gmail.com",
        )
        db.add(influencer)
        await db.commit()
        print("✅ Influencer 'juliana' created successfully!")


if __name__ == "__main__":
    asyncio.run(main())
