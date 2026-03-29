import { useCallback, useContext, useEffect, useRef, useState } from "react";
import { Howl } from "howler";
import { useMicrophonePermission } from "./useMicrophonePermission";
import { ChatRepository } from "@/data/repositories/ChatRepo";
import logger from "@/utils/logger";
import { AuthContext } from "@/context/AuthContext";
import { useConversation } from "@elevenlabs/react";
import { showErrorModal } from "@/utils/errorModal";

export type CallStatus = "connecting" | "connected" | "disconnected" | "idle" | "error";

export type StartConversationOptions =
  | undefined
  | { flow?: "default"; influencerId?: string }
  | { flow: "adult-character"; characterId: number; influencerId?: string };

type NormalizedConversationToken = {
  conversationToken: string;
  creditsRemaining: number | null;
  greetingUsed: string;
  prompt: string;
  nativeLanguage: string;
  registerInfluencerId: string;
  registerAdultCharacterId?: number;
};

export default function useCallWebRTC(options?: {
  onMessage?: (message: any, conversationId: string | null) => void;
  onCreditsExpired?: () => void
}
) {
  const [status, setStatus] = useState<CallStatus>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const {
    permissionState,
    requestMicrophonePermission,
    releaseMicrophonePermission,
  } = useMicrophonePermission();
  const [influencerId, setInfluencerId] = useState<string>();

  const ringtoneRef = useRef<Howl | null>(null);

  const getRingtone = useCallback((): Howl => {
    if (!ringtoneRef.current) {
      ringtoneRef.current = new Howl({ src: ["/audio/ringtone.mp3"], loop: true, html5: false });
    }
    return ringtoneRef.current;
  }, []);
  const chatRepo = ChatRepository();
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null);
  const { user } = useContext(AuthContext);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const stopConversationRef = useRef<() => void>(() => { });
  const startInFlightRef = useRef(false);
  const startAbortControllerRef = useRef<AbortController | null>(null);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const conversationIdRef = useRef<string | null>(null);

  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      if (ringtoneRef.current) {
        ringtoneRef.current.stop();
        ringtoneRef.current.unload();
        ringtoneRef.current = null;
      }
    };
  }, []);

  const ring = useCallback(() => {
    try {
      getRingtone().play();
    } catch (err) {
      console.error("Ringtone playback failed:", err);
    }
  }, [getRingtone]);

  const stopRing = useCallback(() => {
    if (ringtoneRef.current) {
      ringtoneRef.current.stop();
      ringtoneRef.current.unload();
      ringtoneRef.current = null;
    }
  }, []);

  const [micMuted, setMicMuted] = useState<boolean>(false);

  const [agentSettings, setAgentSettings] = useState<{
    prompt: string;
    firstMessage: string;
    language: string;
  } | null>(null);
  const pendingStartRef = useRef<{
    conversationToken: string;
    creditsRemaining: number | null;
    greetingUsed: string;
    registerInfluencerId: string;
    registerAdultCharacterId?: number;
    abortController: AbortController;
  } | null>(null);

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
      ...(agentSettings && {
        agent: {
          prompt: { prompt: agentSettings.prompt },
          firstMessage: agentSettings.firstMessage,
          language: agentSettings.language,
        },
      }),
    },
    onConnect: () => {
      setStatus("connected");
      setErrorMessage(null);
    },
    onDisconnect: () => {
      setStatus("disconnected");
    },
    onError: (error: any) => {
      setStatus("error");
      setErrorMessage(error instanceof Error ? error.message : "Call failed");
      logger.error(error)
    },
    onMessage: (message) => {
      options?.onMessage?.(message, conversationIdRef.current);
    },
  });

  useEffect(() => {
    if (status === "connecting") ring()
    else stopRing();
  }, [status])

  const startConversation = useCallback(async (startOptions?: StartConversationOptions) => {
    const activeInfluencerId = startOptions?.influencerId ?? influencerId;
    if (!activeInfluencerId || startInFlightRef.current) {
      return;
    }
    let errorStatus: number | null = null;
    const abortController = new AbortController();
    if (startAbortControllerRef.current) {
      startAbortControllerRef.current.abort();
    }
    startAbortControllerRef.current = abortController;
    startInFlightRef.current = true;
    setErrorMessage(null);

    try {
      const hasPermission = await requestMicrophonePermission();
      if (!hasPermission) {
        setErrorMessage("Microphone permission is required.");
        showErrorModal({
          title: "Microphone Permission Denied",
          message:
            "Microphone access is required to start the call. Please enable microphone permissions in your browser settings and try again.",
        });
        setStatus("idle");
        if (startAbortControllerRef.current === abortController) {
          startAbortControllerRef.current = null;
        }
        startInFlightRef.current = false;
        return;
      }
      if (!user || !user.id) {
        setErrorMessage("Please log in to start a call.");
        setStatus("idle");
        if (startAbortControllerRef.current === abortController) {
          startAbortControllerRef.current = null;
        }
        startInFlightRef.current = false;
        return;
      }
      if (abortController.signal.aborted) {
        if (startAbortControllerRef.current === abortController) {
          startAbortControllerRef.current = null;
        }
        startInFlightRef.current = false;
        return;
      }
      setStatus("connecting");

      let tokenPayload: NormalizedConversationToken;
      if (startOptions?.flow === "adult-character") {
        const response = await chatRepo.getAdultConversationToken(
          activeInfluencerId,
          startOptions.characterId,
          abortController.signal,
        );
        tokenPayload = {
          conversationToken: response.token,
          creditsRemaining: response.credits_remainder_secs,
          greetingUsed: response.greeting_used ?? "",
          prompt: response.prompt ?? "",
          nativeLanguage: response.native_language || "en",
          registerInfluencerId: response.influencer_id,
          registerAdultCharacterId: response.character_id,
        };
      } else {
        const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
        const response = await chatRepo.getConversationToken(
          activeInfluencerId,
          userTimezone,
          abortController.signal,
        );
        tokenPayload = {
          conversationToken: response.token,
          creditsRemaining: response.credits_remainder_secs ?? null,
          greetingUsed: response.greeting_used ?? "",
          prompt: response.prompt ?? "",
          nativeLanguage: response.native_language || "en",
          registerInfluencerId: activeInfluencerId,
        };
      }

      if (abortController.signal.aborted) {
        if (startAbortControllerRef.current === abortController) {
          startAbortControllerRef.current = null;
        }
        startInFlightRef.current = false;
        return;
      }

      if (!tokenPayload.conversationToken) {
        setErrorMessage("Unable to start a conversation right now.");
        setStatus("idle");
        if (startAbortControllerRef.current === abortController) {
          startAbortControllerRef.current = null;
        }
        startInFlightRef.current = false;
        return;
      }

      if ((tokenPayload.creditsRemaining ?? 0) <= 0) {
        setErrorMessage("You have no remaining credits.");
        setStatus("idle");
        if (startAbortControllerRef.current === abortController) {
          startAbortControllerRef.current = null;
        }
        startInFlightRef.current = false;
        return;
      }

      setAgentSettings({
        prompt: tokenPayload.prompt,
        firstMessage: tokenPayload.greetingUsed,
        language: tokenPayload.nativeLanguage,
      });
      pendingStartRef.current = {
        conversationToken: tokenPayload.conversationToken,
        // Adult conversation-token currently returns a compatibility countdown value.
        creditsRemaining: tokenPayload.creditsRemaining,
        greetingUsed: tokenPayload.greetingUsed,
        registerInfluencerId: tokenPayload.registerInfluencerId,
        registerAdultCharacterId: tokenPayload.registerAdultCharacterId,
        abortController,
      };
      return;
    } catch (error: any) {
      if (!abortController.signal.aborted) {
        setStatus("error");
        setErrorMessage(
          error?.response?.data?.detail?.error ||
          error?.response?.data?.detail ||
          error?.message ||
          "Call failed"
        );
        logger.error(error);
        errorStatus = error.response?.status ?? null;
      }
    }
    if (startAbortControllerRef.current === abortController) {
      startAbortControllerRef.current = null;
    }
    startInFlightRef.current = false;
    return { errorStatus };
  }, [chatRepo, influencerId, requestMicrophonePermission, user]);

  useEffect(() => {
    const pending = pendingStartRef.current;
    if (!agentSettings || !pending) {
      return;
    }
    pendingStartRef.current = null;
    (async () => {
      const {
        conversationToken,
        creditsRemaining,
        greetingUsed,
        registerInfluencerId,
        registerAdultCharacterId,
        abortController,
      } = pending;
      if (abortController.signal.aborted) {
        if (startAbortControllerRef.current === abortController) {
          startAbortControllerRef.current = null;
        }
        startInFlightRef.current = false;
        return;
      }
      try {
        const conversationId = await conversation.startSession({
          conversationToken,
          connectionType: "webrtc",
          dynamicVariables: {
            first_message: greetingUsed,
          },
        });

        if (abortController.signal.aborted) {
          await conversation.endSession();
          return;
        }

        if (user && user.id) {
          const registerPayload = {
            user_id: user?.id ?? 0,
            influencer_id: registerInfluencerId,
            sid: crypto.randomUUID(),
            ...(registerAdultCharacterId !== undefined
              ? {
                is_adult_call: true,
                adult_character_id: registerAdultCharacterId,
              }
              : {}),
          };
          await chatRepo.registerConversation(
            conversationId,
            registerPayload,
            abortController.signal,
          );
        }

        if (abortController.signal.aborted) {
          await conversation.endSession();
          return;
        }
        setConversationId(conversationId);
        conversationIdRef.current = conversationId;
        setTimeRemaining(creditsRemaining);
      } catch (error: any) {
        if (!abortController.signal.aborted) {
          setStatus("error");
          setErrorMessage(error.response?.data?.detail?.error || "Call failed");
          logger.error(error);
        }
      } finally {
        if (startAbortControllerRef.current === abortController) {
          startAbortControllerRef.current = null;
        }
        startInFlightRef.current = false;
      }
    })();
  }, [agentSettings, chatRepo, conversation, influencerId, user]);

  const stopConversation = useCallback(async () => {
    if (startAbortControllerRef.current) {
      startAbortControllerRef.current.abort();
      startAbortControllerRef.current = null;
    }
    startInFlightRef.current = false;
    setStatus("idle");
    setErrorMessage(null);
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
  }, [conversation, releaseMicrophonePermission]);

  const cancelCall = useCallback(() => {
    if (status !== "connecting") {
      return;
    }
    if (startAbortControllerRef.current) {
      startAbortControllerRef.current.abort();
      startAbortControllerRef.current = null;
    }
    startInFlightRef.current = false;
    setStatus("idle");
    setErrorMessage(null);
  }, [status]);

  useEffect(() => {
    stopConversationRef.current = stopConversation;
  }, [stopConversation]);

  useEffect(() => {
    if (timeRemaining === null) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    if (timeRemaining === 0) {
      options?.onCreditsExpired?.();
      stopConversationRef.current();
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
  }, [timeRemaining]);

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
    errorMessage,
    timeRemaining,
    micMuted,
    toggleMute,
    setMicMuted,
    cancelCall,
    conversationId,
  };
}
