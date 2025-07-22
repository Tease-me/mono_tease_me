import { ELEVENLABS_AGENT_ID, ELEVENLABS_API_KEY } from "../env";

export async function getSignedUrl() {
    const response = await fetch(
        `https://api.elevenlabs.io/v1/convai/conversation/get-signed-url?agent_id=${ELEVENLABS_AGENT_ID}`,
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