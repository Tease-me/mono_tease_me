import { ELEVENLABS_API_KEY } from "@/env";
import axios from 'axios';

const API_BASE_URL = "https://api.elevenlabs.io/v1";

export const elevenLabsClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10_000,
  headers: { "xi-api-key": ELEVENLABS_API_KEY ?? "" },
});

export const elevenLabsServices = {

  getSignedUrl: async (influencer_id?: string) => {
    const agent_id = influencer_id;
    const response = await elevenLabsClient.get("/convai/conversation/get-signed-url", {
      params: { agent_id }
    })
    if (response.status !== 200) {
      return;
    }

    const body = await response.data;
    return body.signed_url;
  },
};
