import { useConversation } from "@11labs/react";
import { useCallback, useContext, useEffect, useRef, useState } from "react";
import { useMicrophonePermission } from "./useMicrophonePermission";
import { ChatRepository } from "@/data/repositories/ChatRepo";
import logger from "@/utils/logger";
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
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null);
  const { user } = useContext(AuthContext);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (timeRemaining === null) return;

    if (timeRemaining === 0) {
      stopConversation();
      return;
    }

    intervalRef.current = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev === null) return null;
        if (prev <= 1) {
          clearInterval(intervalRef.current as NodeJS.Timeout);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [timeRemaining]);


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
    if (influencerId && user) {
      ring();
      const hasPermission = await requestMicrophonePermission();
      if (!hasPermission) {
        alert("No permission");
        return;
      }

      const { signed_url, credits_remainder_secs } = await chatRepo.getSignedUrl(influencerId, user.id ?? 0);
      if (!signed_url) {
        stopRing();
        return;
      }
      if (credits_remainder_secs <= 0) {
        alert("You have no remaining credits. Please top up to start a conversation.");
        stopRing();
        return;
      }

      const conversationId = await conversation.startSession({ signedUrl: signed_url });
      await chatRepo.registerConversation(conversationId, user?.id ?? 0, influencerId);
      setTimeRemaining(credits_remainder_secs);
    }
  }

  const stopConversation = useCallback(async () => {
    await conversation.endSession();
    releaseMicrophonePermission();
    setTimeRemaining(null);
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }
  }, [conversation]);

  return {
    setInfluencerId,
    startConversation,
    stopConversation,
    permissionState,
    status,
    timeRemaining
  };
}
