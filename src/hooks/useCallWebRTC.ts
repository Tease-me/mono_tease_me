import { useCallback, useContext, useEffect, useRef, useState } from "react";
import { useMicrophonePermission } from "./useMicrophonePermission";
import { ChatRepository } from "@/data/repositories/ChatRepo";
import logger from "@/utils/logger";
import { AuthContext } from "@/context/AuthContext";
import { useConversation } from "@elevenlabs/react";
export type CallStatus = "connecting" | "connected" | "disconnected" | "idle" | "error";

export default function useCallWebRTC() {
  const [status, setStatus] = useState<CallStatus>("idle");
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

  const [micMuted, setMicMuted] = useState<boolean>(false);
  const [agentPrompt, setAgentPrompt] = useState<string | undefined>(undefined);
  const [agentFirstMessage, setAgentFirstMessage] = useState<string | undefined>(undefined);
  const [agentLanguage, setAgentLanguage] = useState<string>("en");

  const conversation = useConversation({
    micMuted,
    audio: {
      constraints: {
        audio: {
          noiseSuppression: true,
          echoCancellation: true,
          autoGainControl: true,
          voiceIsolation: true
        }
      }
    },
    overrides: {
      agent: {
        prompt: { prompt: agentPrompt },
        firstMessage: agentFirstMessage,
        language: agentLanguage,
      },
    },
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

  useEffect(() => {
    if (status === "connecting") ring()
    else stopRing();
  }, [status])

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

    try {
      const hasPermission = await requestMicrophonePermission();
      if (!hasPermission) {
        alert("No permission");
        setStatus("idle");
        stopRing();
        return;
      }
      if (!user || !user.id) {
        alert("Please log in to start a call.");
        setStatus("idle");
        stopRing();
        return;
      }
      if (abortController.signal.aborted) {
        return;
      }

      const { token: conversationToken, credits_remainder_secs, greeting_used, prompt, native_language } = await chatRepo.getConversationToken(
        influencerId,
        user.id,
        abortController.signal,
      );

      setAgentLanguage(native_language || "en");
      setAgentPrompt(prompt || undefined);
      setAgentFirstMessage(greeting_used ?? undefined);

      if (abortController.signal.aborted) {
        return;
      }

      if (!conversationToken) {
        stopRing();
        setStatus("idle");
        return;
      }

      if ((credits_remainder_secs ?? 0) <= 0) {
        alert("You have no remaining credits. Please top up to start a conversation.");
        stopRing();
        setStatus("idle");
        return;
      }

      const conversationId = await conversation.startSession({
        conversationToken,
        connectionType: "webrtc",
        dynamicVariables: {
          first_message: greeting_used ?? "",
        },
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

      setTimeRemaining(credits_remainder_secs ?? null);
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

  const toggleMute = useCallback(() => {
    setMicMuted(prev => {
      const next = !prev;
      return next;
    });
  }, []);

  return {
    setInfluencerId,
    startConversation,
    stopConversation,
    permissionState,
    status,
    timeRemaining,
    micMuted,
    toggleMute,
    setMicMuted,
  };
}
