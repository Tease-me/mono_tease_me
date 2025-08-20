import { useConversation } from "@11labs/react";
import { useCallback, useContext, useRef, useState } from "react";
import { useMicrophonePermission } from "./useMicrophonePermission";
import { ChatRepository } from "@/data/repositories/ChatRepo";
import logger from "@/utils/logger";
import { apiClient } from "@/api/apis";
import { AuthContext } from "@/context/AuthContext";

export default function useCall() {
  const [status, setStatus] = useState<
    "connecting" | "connected" | "disconnected" | "idle" | "error"
  >("idle");
  const {
    permissionState,
    requestMicrophonePermission,
    releaseMicrophonePermission,
  } = useMicrophonePermission();
  const [influencerId, setInfluencerId] = useState<string>();

  const ringtoneRef = useRef(new Audio("/audio/ringtone.wav"));
  const chatRepo = ChatRepository();

  const { user } = useContext(AuthContext);

  const ring = () => {
    const ringtone = ringtoneRef.current;
    ringtone.loop = true;

    ringtone.play().catch((err) => {
      console.error("Ringtone playback failed:", err);
    });
  };

  const stopRing = () => {
    ringtoneRef.current.pause();
    ringtoneRef.current.currentTime = 0;
  };

  const conversation = useConversation({
    onConnect: () => {
      setStatus("connected");
      stopRing();
    },
    onDisconnect: () => {
      setStatus("disconnected");
    },
    onError: (error) => {
      setStatus("error");
      logger.error(error)
    },
    onMessage: (message) => {
      logger.debug(message);
    },
  });


  async function startConversation() {
    console.error("Starting conversation with influencerId:", influencerId);
    if (influencerId) {
      ring();
      const hasPermission = await requestMicrophonePermission();
      if (!hasPermission) {
        alert("No permission");
        return;
      }

      const signedUrl = await chatRepo.getSignedUrl(influencerId);
      if (!signedUrl) {
        stopRing();
        return;
      }
      const conversationId = await conversation.startSession({ signedUrl });
      const sid = crypto.randomUUID();
      await registerConversation(conversationId, {
        user_id: user?.id ?? 0,
        influencer_id: influencerId,
        sid: sid ?? null,
      });
    }
  }

  type RegisterBody = {
    user_id: number;
    influencer_id?: string | null;
    sid?: string | null;
  };

  async function registerConversation(
    conversationId: string,
    body: RegisterBody,
    maxRetries = 3
  ): Promise<void> {
    const url = `/elevenlabs/conversations/${encodeURIComponent(
      conversationId
    )}/register`;
    let attempt = 0;
    let delay = 400;
    while (true) {
      try {
        await apiClient.post(url, body);
        return; // success
      } catch (err: any) {
        attempt += 1;
        if (attempt > maxRetries) {
          // bubble up original error/response data if available
          const status = err?.response?.status;
          const data = err?.response?.data;
          throw new Error(
            `register failed (${status ?? "no-status"}): ${JSON.stringify(data)}`
          );
        }
        await new Promise((r) => setTimeout(r, delay));
        delay = Math.min(2000, Math.floor(delay * 1.8));
      }
    }
  }

  const stopConversation = useCallback(async () => {
    await conversation.endSession();
    releaseMicrophonePermission();
  }, [conversation]);

  return {
    setInfluencerId,
    startConversation,
    stopConversation,
    permissionState,
    status,
  };
}
