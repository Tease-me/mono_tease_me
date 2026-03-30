import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AdultVoiceCallState, AdultVoiceError, AdultVoiceServerMessage, AdultVoiceSocketStatus } from "@/api/models/adultVoice";
import { Endpoints, WS_BASE_URL } from "@/api/urls";
import { LocalStorageKeys } from "@/constants/localStorageKeys";
import { useMicrophonePermission } from "./useMicrophonePermission";
import { showErrorModal } from "@/utils/errorModal";
import logger from "@/utils/logger";
import { storage } from "@/utils/storage";
import { MicCapture, PcmPlayer } from "@/utils/adultVoiceAudio";
import { createCallRingtoneController } from "@/utils/callRingtone";

type StartAdultCallArgs = {
  influencerId: string;
  characterId: number;
  timezone?: string;
};

type UseAdultVoiceCallOptions = {
  onInsufficientCredits?: () => void;
};

export default function useAdultVoiceCall(options?: UseAdultVoiceCallOptions) {
  const [socketStatus, setSocketStatus] = useState<AdultVoiceSocketStatus>("idle");
  const [callState, setCallState] = useState<AdultVoiceCallState>(null);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [chatId, setChatId] = useState<string | null>(null);
  const [remainingSeconds, setRemainingSeconds] = useState<number | null>(null);
  const [error, setError] = useState<AdultVoiceError | null>(null);
  const [isMicStreaming, setIsMicStreaming] = useState(false);
  const [isPlaybackActive, setIsPlaybackActive] = useState(false);
  const [isMuted, setIsMuted] = useState(false);

  const socketRef = useRef<WebSocket | null>(null);
  const pingIntervalRef = useRef<number | null>(null);
  const micCaptureRef = useRef<MicCapture | null>(null);
  const playerRef = useRef<PcmPlayer | null>(null);
  const stopRequestedRef = useRef(false);
  const ringtoneRef = useRef(createCallRingtoneController());

  const { permissionState, requestMicrophonePermission, releaseMicrophonePermission } =
    useMicrophonePermission();

  const stopPing = useCallback(() => {
    if (pingIntervalRef.current !== null) {
      window.clearInterval(pingIntervalRef.current);
      pingIntervalRef.current = null;
    }
  }, []);

  const teardownAudio = useCallback(async () => {
    setIsMicStreaming(false);
    if (micCaptureRef.current) {
      await micCaptureRef.current.stop();
      micCaptureRef.current = null;
    }
    if (playerRef.current) {
      await playerRef.current.stop();
      playerRef.current = null;
    }
    setIsPlaybackActive(false);
    releaseMicrophonePermission();
  }, [releaseMicrophonePermission]);

  const closeSocket = useCallback((code?: number, reason?: string) => {
    const socket = socketRef.current;
    socketRef.current = null;
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.close(code, reason);
    } else if (socket && socket.readyState === WebSocket.CONNECTING) {
      socket.close();
    }
  }, []);

  const resetSessionState = useCallback(() => {
    setCallState(null);
    setConversationId(null);
    setChatId(null);
    setRemainingSeconds(null);
  }, []);

  const stopCall = useCallback(async () => {
    stopRequestedRef.current = true;
    stopPing();
    ringtoneRef.current.stop();
    const socket = socketRef.current;
    if (socket?.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({ type: "stop_call" }));
    }
    closeSocket(1000, "client_stop");
    setSocketStatus("closed");
    setCallState("ended");
    await teardownAudio();
  }, [closeSocket, stopPing, teardownAudio]);

  const setTransportError = useCallback(
    async (nextError: AdultVoiceError, shouldCloseSocket: boolean = true) => {
      ringtoneRef.current.stop();
      setError(nextError);
      setSocketStatus("error");
      if (shouldCloseSocket) {
        closeSocket();
      }
      await teardownAudio();
    },
    [closeSocket, teardownAudio],
  );

  const startPing = useCallback(() => {
    stopPing();
    pingIntervalRef.current = window.setInterval(() => {
      if (socketRef.current?.readyState === WebSocket.OPEN) {
        socketRef.current.send(JSON.stringify({ type: "ping" }));
      }
    }, 25000);
  }, [stopPing]);

  const startMicStreaming = useCallback(async () => {
    const socket = socketRef.current;
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      return;
    }
    const micCapture = new MicCapture((audio) => {
      if (socketRef.current?.readyState !== WebSocket.OPEN) {
        return;
      }
      socketRef.current.send(
        JSON.stringify({
          type: "input_audio_chunk",
          audio,
        }),
      );
    });
    micCapture.setMuted(isMuted);
    await micCapture.start();
    micCaptureRef.current = micCapture;
    setIsMicStreaming(true);
  }, [isMuted]);

  const handleServerMessage = useCallback(
    async (message: AdultVoiceServerMessage) => {
      switch (message.type) {
        case "call_started":
          ringtoneRef.current.stop();
          setChatId(message.chat_id);
          setConversationId(message.conversation_id);
          setRemainingSeconds(message.credits_remainder_secs);
          return;
        case "state":
          if (message.state !== "connecting") {
            ringtoneRef.current.stop();
          }
          setCallState(message.state);
          if (message.state === "ended") {
            setSocketStatus("closed");
            await teardownAudio();
          }
          return;
        case "output_audio_chunk":
          if (!playerRef.current) {
            playerRef.current = new PcmPlayer(setIsPlaybackActive);
          }
          await playerRef.current.enqueueBase64Pcm16(message.audio);
          return;
        case "remaining_time":
          setRemainingSeconds(message.seconds);
          return;
        case "error":
          ringtoneRef.current.stop();
          setError({
            code: message.error,
            message: message.message,
          });
          setSocketStatus("error");
          if (message.error === "INSUFFICIENT_CREDITS") {
            options?.onInsufficientCredits?.();
          }
          return;
        case "pong":
          return;
        default:
          return;
      }
    },
    [options, teardownAudio],
  );

  const startCall = useCallback(
    async ({ influencerId, characterId, timezone }: StartAdultCallArgs) => {
      if (!influencerId || socketStatus === "connecting") {
        return;
      }

      ringtoneRef.current.start();

      const token = storage.get(LocalStorageKeys.AccessToken);
      if (!token) {
        await setTransportError({
          code: "AUTH_REQUIRED",
          message: "Please log in to start a call.",
        });
        return;
      }

      const hasPermission = await requestMicrophonePermission();
      if (!hasPermission) {
        ringtoneRef.current.stop();
        setError({
          code: "MIC_PERMISSION_DENIED",
          message: "Microphone permission is required.",
        });
        showErrorModal({
          title: "Microphone Permission Denied",
          message:
            "Microphone access is required to start the call. Please enable microphone permissions in your browser settings and try again.",
        });
        setSocketStatus("idle");
        return;
      }

      stopRequestedRef.current = false;
      setError(null);
      resetSessionState();
      setCallState("connecting");
      setSocketStatus("connecting");

      const encodedToken = encodeURIComponent(token);
      const wsUrl = `${WS_BASE_URL}${Endpoints.adult.voice(influencerId)}?token=${encodedToken}`;
      const socket = new WebSocket(wsUrl);
      socketRef.current = socket;

      socket.onopen = async () => {
        setSocketStatus("open");
        socket.send(
          JSON.stringify({
            type: "start_call",
            character_id: characterId,
            timezone: timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone,
          }),
        );
        startPing();
        try {
          await startMicStreaming();
        } catch (err) {
          logger.error("Failed to start microphone capture", err);
          await setTransportError({
            code: "MIC_CAPTURE_FAILED",
            message: "Unable to start microphone capture.",
          });
        }
      };

      socket.onmessage = (event) => {
        void (async () => {
          try {
            const parsed = JSON.parse(event.data) as AdultVoiceServerMessage;
            await handleServerMessage(parsed);
          } catch (err) {
            logger.error("Failed to process adult voice message", err);
          }
        })();
      };

      socket.onerror = () => {
        void setTransportError({
          code: "SOCKET_ERROR",
          message: "Voice connection failed.",
        }, false);
      };

      socket.onclose = (event) => {
        stopPing();
        socketRef.current = null;
        ringtoneRef.current.stop();
        void teardownAudio();

        if (stopRequestedRef.current && event.code === 1000) {
          setSocketStatus("closed");
          return;
        }

        if (event.code === 4401) {
          setError({
            code: "TOKEN_EXPIRED",
            message: "Your session expired. Please sign in again.",
          });
          setSocketStatus("error");
          return;
        }

        if (event.code === 4403) {
          setError((prev) => prev ?? {
            code: "FORBIDDEN",
            message: "You do not have access to this voice call.",
          });
          setSocketStatus("error");
          return;
        }

        if (!stopRequestedRef.current && event.code !== 1000) {
          setError((prev) => prev ?? {
            code: "SOCKET_CLOSED",
            message: "The voice connection ended unexpectedly.",
          });
          setSocketStatus("error");
          return;
        }

        setSocketStatus("closed");
      };
    },
    [
      handleServerMessage,
      requestMicrophonePermission,
      resetSessionState,
      setTransportError,
      socketStatus,
      startMicStreaming,
      startPing,
      stopPing,
      teardownAudio,
    ],
  );

  const toggleMute = useCallback(() => {
    setIsMuted((prev) => {
      const next = !prev;
      micCaptureRef.current?.setMuted(next);
      return next;
    });
  }, []);

  useEffect(() => {
    if (remainingSeconds !== 0) {
      return;
    }

    if (socketStatus !== "open" && socketStatus !== "error") {
      return;
    }

    options?.onInsufficientCredits?.();
    void stopCall();
  }, [options, remainingSeconds, socketStatus, stopCall]);

  useEffect(() => {
    micCaptureRef.current?.setMuted(isMuted);
  }, [isMuted]);

  useEffect(() => {
    return () => {
      stopPing();
      closeSocket();
      ringtoneRef.current.unload();
      void teardownAudio();
    };
  }, [closeSocket, stopPing, teardownAudio]);

  const uiStatus = useMemo(() => {
    if (socketStatus === "error") {
      return "error" as const;
    }
    if (socketStatus === "connecting" || callState === "connecting") {
      return "connecting" as const;
    }
    if (
      callState === "listening" ||
      callState === "agent_speaking" ||
      callState === "ending"
    ) {
      return "connected" as const;
    }
    if (socketStatus === "closed") {
      return "disconnected" as const;
    }
    return "idle" as const;
  }, [callState, socketStatus]);

  return {
    startCall,
    stopCall,
    toggleMute,
    setMuted: setIsMuted,
    permissionState,
    socketStatus,
    callState,
    conversationId,
    chatId,
    remainingSeconds,
    error,
    isMicStreaming,
    isPlaybackActive,
    isMuted,
    status: uiStatus,
  };
}
