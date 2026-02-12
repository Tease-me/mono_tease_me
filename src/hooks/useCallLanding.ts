import { useCallback, useContext, useEffect, useRef, useState } from "react";
import { Howl } from "howler";
import { useMicrophonePermission } from "./useMicrophonePermission";
import { ChatRepository } from "@/data/repositories/ChatRepo";
import logger from "@/utils/logger";
import { AuthContext } from "@/context/AuthContext";
import { useConversation } from "@elevenlabs/react";
import { showErrorModal } from "@/utils/errorModal";

export default function useCallLanding() {
  const [status, setStatus] = useState<
    "connecting" | "connected" | "disconnected" | "idle" | "error"
  >("idle");
  const {
    permissionState,
    requestMicrophonePermission,
    releaseMicrophonePermission,
  } = useMicrophonePermission();
  const [influencerId, setInfluencerId] = useState<string>();

  const ringtoneRef = useRef(
    new Howl({ src: ["/audio/ringtone.mp3"], loop: true, html5: true })
  );
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
  useEffect(() => {
    return () => {
      ringtoneRef.current.stop();
      ringtoneRef.current.unload();
    };
  }, []);

  const ring = useCallback(() => {
    const ringtone = ringtoneRef.current;
    try {
      ringtone.play();
    } catch (err) {
      console.error("Ringtone playback failed:", err);
    }
  }, []);

  const stopRing = useCallback(() => {
    ringtoneRef.current.stop();
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
        setStatus("error");
        showErrorModal({
          title: "Microphone Permission Denied",
          message:
            "Microphone access is required to start the call. Please enable microphone permissions in your browser settings and try again.",
        });
        stopRing();
        return;
      }
      if (abortController.signal.aborted) {
        return;
      }

      let signed_url: string | null = null;

      const response = await chatRepo.getFreeSignedLandingUrl(
        abortController.signal,
      );
      if (abortController.signal.aborted) {
        return;
      }
      signed_url = response.signed_url;

      if (!signed_url) {
        stopRing();
        setStatus("idle");
        return;
      }

      await conversation.startSession({
        signedUrl: signed_url,
      });

      if (abortController.signal.aborted) {
        await conversation.endSession();
        return;
      }

      if (abortController.signal.aborted) {
        await conversation.endSession();
        return;
      }
      setTimeRemaining(300);
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
