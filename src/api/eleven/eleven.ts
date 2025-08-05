import { ELEVENLABS_AGENT_ID, ELEVENLABS_API_KEY, ELEVENLABS_VOICE_IDS } from "@/env";

export async function getSignedUrl(influencer_id?: string) {
    const agent_id = influencer_id ? ELEVENLABS_VOICE_IDS[influencer_id] : ELEVENLABS_AGENT_ID;
    const response = await fetch(
        `https://api.elevenlabs.io/v1/convai/conversation/get-signed-url?agent_id=${agent_id}`,
        {
            headers: {
                "xi-api-key": ELEVENLABS_API_KEY ?? "",
            },
        }
    );

    if (!response.ok) {
        return;
    }

    const body = await response.json();
    return body.signed_url
}