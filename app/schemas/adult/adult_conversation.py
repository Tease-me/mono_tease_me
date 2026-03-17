from pydantic import BaseModel


class AdultConversationTokenRequest(BaseModel):
    influencer_id: str
    character_id: int


class AdultConversationTokenResponse(BaseModel):
    token: str
    agent_id: str
    credits_remainder_secs: int
    prompt: str
    greeting_used: str | None = None
    voice_id: str | None = None
    native_language: str = "en"
    influencer_id: str
    character_id: int
