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
  const startInFlightRef = useRef(false);
  const startAbortControllerRef = useRef<AbortController | null>(null);
  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  const ring = useCallback(() => {
    const ringtone = ringtoneRef.current;
    ringtone.loop = true;

    ringtone.play().catch((err) => {
      console.error("Ringtone playback failed:", err);
    });
  }, []);

  const stopRing = useCallback(() => {
    ringtoneRef.current.pause();
    ringtoneRef.current.currentTime = 0;
  }, []);

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


  const startConversation = useCallback(async () => {
    if (!influencerId || startInFlightRef.current) {
      return;
    }
    const abortController = new AbortController();
    if (startAbortControllerRef.current) {
      startAbortControllerRef.current.abort();
    }
    startAbortControllerRef.current = abortController;
    startInFlightRef.current = true;
    setStatus("connecting");
    ring();
    try {
      const hasPermission = await requestMicrophonePermission();
      if (!hasPermission) {
        alert("No permission");
        setStatus("idle");
        stopRing();
        return;
      }
      if (abortController.signal.aborted) {
        return;
      }

      let signed_url: string | null = null;
      let credits_remainder_secs = 30;
      let first_message = "Hi there who am I speaking to?";

      if (!user || !user.id) {
        const response = await chatRepo.getFreeSignedUrl(
          influencerId,
          abortController.signal,
        );
        if (abortController.signal.aborted) {
          return;
        }
        signed_url = response.signed_url;
        credits_remainder_secs = response.credits_remainder_secs;
        first_message = response.first_message || first_message;
      } else {
        const response = await chatRepo.getSignedUrl(
          influencerId,
          user.id ?? 0,
          abortController.signal,
        );
        if (abortController.signal.aborted) {
          return;
        }
        signed_url = response.signed_url;
        credits_remainder_secs = response.credits_remainder_secs;
        first_message = response.first_message || first_message;
      }

      if (!signed_url) {
        stopRing();
        setStatus("idle");
        return;
      }

      if (credits_remainder_secs <= 0) {
        alert("You have no remaining credits. Please top up to start a conversation.");
        stopRing();
        setStatus("idle");
        return;
      }

      const conversationId = await conversation.startSession({
        signedUrl: signed_url,
        dynamicVariables: {
          first_message: first_message,
        }
      });

      if (abortController.signal.aborted) {
        await conversation.endSession();
        return;
      }

      if (user && user.id) {
        await chatRepo.registerConversation(
          conversationId,
          user?.id ?? 0,
          influencerId,
          abortController.signal,
        );
      }

      if (abortController.signal.aborted) {
        await conversation.endSession();
        return;
      }

      setTimeRemaining(credits_remainder_secs);
    } catch (error) {
      if (!abortController.signal.aborted) {
        setStatus("error");
        logger.error(error);
      }
    } finally {
      if (startAbortControllerRef.current === abortController) {
        startAbortControllerRef.current = null;
      }
      startInFlightRef.current = false;
    }
  }, [chatRepo, conversation, influencerId, requestMicrophonePermission, ring, stopRing, user]);

  const stopConversation = useCallback(async () => {
    if (startAbortControllerRef.current) {
      startAbortControllerRef.current.abort();
      startAbortControllerRef.current = null;
    }
    startInFlightRef.current = false;
    stopRing();
    setStatus("idle");
    setTimeRemaining(null);
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    releaseMicrophonePermission();
    try {
      await conversation.endSession();
    } catch (error) {
      logger.warn("Failed to end session cleanly", error);
    }
  }, [conversation, releaseMicrophonePermission, stopRing]);

  useEffect(() => {
    if (timeRemaining === null) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    if (timeRemaining === 0) {
      stopConversation();
      return;
    }

    if (intervalRef.current) {
      return;
    }

    intervalRef.current = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev === null) return null;
        if (prev <= 1) {
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [timeRemaining, stopConversation]);

  return {
    setInfluencerId,
    startConversation,
    stopConversation,
    permissionState,
    status,
    timeRemaining
  };
}
