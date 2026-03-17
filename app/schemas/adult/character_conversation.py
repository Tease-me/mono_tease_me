from pydantic import BaseModel


class CharacterConversationTokenRequest(BaseModel):
    influencer_id: str
    character_id: int


class CharacterConversationTokenResponse(BaseModel):
    token: str
    agent_id: str
    prompt: str
    greeting_used: str | None = None
    voice_id: str | None = None
    native_language: str = "en"
    influencer_id: str
    character_id: int
