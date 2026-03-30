import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ADULT_CALL_TRANSPORT } from "@/constants/featureFlags";
import { apiClient } from "@/api/apis";
import { ChatRepository } from "@/data/repositories/ChatRepo";
import { UserServices } from "@/api/services/UserServices";
import useAdultVoiceCall from "./useAdultVoiceCall";
import useCallWebRTC, { CallStatus } from "./useCallWebRTC";

type StartAdultCallArgs = {
  influencerId: string;
  characterId: number;
  timezone?: string;
};

type UseAdultCallTransportOptions = {
  onInsufficientCredits?: () => void;
};

type PostCallSummary = {
  estimatedDurationSeconds: number | null;
  estimatedCostCents: number | null;
  confirmedDurationSeconds: number | null;
  confirmedCostCents: number | null;
  isEstimate: boolean;
};

const chatRepo = ChatRepository();
const userServices = UserServices(apiClient);
const POST_CALL_SUMMARY_RETRY_DELAYS_MS = [1200, 2500, 5000];

function getAdultCallStateLabel(
  status: CallStatus,
  transport: typeof ADULT_CALL_TRANSPORT,
  backendCallState: string | null,
): string {
  if (transport === "backend_voice") {
    if (backendCallState === "connecting" || status === "connecting") {
      return "Connecting...";
    }
    if (backendCallState === "listening") {
      return "Listening...";
    }
    if (backendCallState === "agent_speaking") {
      return "Speaking...";
    }
    if (backendCallState === "ending") {
      return "Ending...";
    }
    return "";
  }

  if (status === "connecting") {
    return "Connecting...";
  }
  if (status === "connected") {
    return "Connected";
  }
  return "";
}

export default function useAdultCallTransport(
  options?: UseAdultCallTransportOptions,
) {
  const {
    startCall: startBackendCall,
    stopCall: stopBackendCall,
    status: backendStatus,
    socketStatus,
    callState: backendCallState,
    error: backendError,
    conversationId: backendConversationId,
  } = useAdultVoiceCall({
    onInsufficientCredits: options?.onInsufficientCredits,
  });

  const {
    setInfluencerId: setWebrtcInfluencerId,
    startConversation,
    stopConversation,
    status: webrtcStatus,
    errorMessage: webrtcErrorMessage,
    conversationId: webrtcConversationId,
    unitPriceCents: webrtcUnitPriceCents,
  } = useCallWebRTC({
    onCreditsExpired: options?.onInsufficientCredits,
  });

  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [activeUnitPriceCents, setActiveUnitPriceCents] = useState<number | null>(null);
  const [postCallSummary, setPostCallSummary] = useState<PostCallSummary | null>(null);
  const [pendingSummaryRefresh, setPendingSummaryRefresh] = useState(false);
  const elapsedIntervalRef = useRef<number | null>(null);
  const previousIsCallActiveRef = useRef(false);
  const hadLiveConnectionRef = useRef(false);
  const currentInfluencerIdRef = useRef<string | null>(null);
  const currentConversationIdRef = useRef<string | null>(null);

  const transport = ADULT_CALL_TRANSPORT;
  const status = transport === "backend_voice" ? backendStatus : webrtcStatus;
  const conversationId =
    transport === "backend_voice" ? backendConversationId : webrtcConversationId;
  const error =
    transport === "backend_voice"
      ? backendError
      : webrtcErrorMessage
        ? { code: "WEBRTC_ERROR", message: webrtcErrorMessage }
        : null;

  const currentUnitPriceCents =
    transport === "backend_voice" ? activeUnitPriceCents : webrtcUnitPriceCents;

  const isCallActive = useMemo(() => {
    if (transport === "backend_voice") {
      return (
        socketStatus === "connecting" ||
        (socketStatus === "open" && backendCallState !== "ended")
      );
    }
    return webrtcStatus === "connecting" || webrtcStatus === "connected";
  }, [backendCallState, socketStatus, transport, webrtcStatus]);

  const activeStatusLabel = useMemo(
    () => getAdultCallStateLabel(status, transport, backendCallState),
    [backendCallState, status, transport],
  );

  const showPostCallSummary = postCallSummary !== null;

  const refreshPostCallSummary = useCallback(
    async (endedConversationId: string | null) => {
      const influencerId = currentInfluencerIdRef.current;
      if (!influencerId) {
        setPendingSummaryRefresh(false);
        return;
      }

      for (const delay of POST_CALL_SUMMARY_RETRY_DELAYS_MS) {
        if (delay > 0) {
          await new Promise((resolve) => window.setTimeout(resolve, delay));
        }

        try {
          const usage = await userServices.getUserUsage(influencerId);
          const summary = usage.latest_adult_call_summary;
          if (!summary) {
            continue;
          }

          const matchesCurrentCall =
            !endedConversationId ||
            summary.conversation_id === endedConversationId;

          if (!matchesCurrentCall) {
            continue;
          }

          setPostCallSummary((prev) =>
            prev
              ? {
                  ...prev,
                  confirmedDurationSeconds: summary.duration_seconds ?? null,
                  confirmedCostCents: summary.cost_cents ?? null,
                  isEstimate: false,
                }
              : {
                  estimatedDurationSeconds: summary.duration_seconds ?? null,
                  estimatedCostCents: summary.cost_cents ?? null,
                  confirmedDurationSeconds: summary.duration_seconds ?? null,
                  confirmedCostCents: summary.cost_cents ?? null,
                  isEstimate: false,
                },
          );
          setPendingSummaryRefresh(false);
          return;
        } catch {
          continue;
        }
      }

      setPendingSummaryRefresh(false);
    },
    [],
  );

  useEffect(() => {
    if (transport !== "webrtc") {
      return;
    }

    setWebrtcInfluencerId(undefined);
  }, [setWebrtcInfluencerId, transport]);

  useEffect(() => {
    if (!isCallActive) {
      if (elapsedIntervalRef.current !== null) {
        window.clearInterval(elapsedIntervalRef.current);
        elapsedIntervalRef.current = null;
      }
      return;
    }

    if (elapsedIntervalRef.current !== null) {
      return;
    }

    elapsedIntervalRef.current = window.setInterval(() => {
      setElapsedSeconds((prev) => prev + 1);
    }, 1000);

    return () => {
      if (elapsedIntervalRef.current !== null) {
        window.clearInterval(elapsedIntervalRef.current);
        elapsedIntervalRef.current = null;
      }
    };
  }, [isCallActive]);

  useEffect(() => {
    currentConversationIdRef.current = conversationId;
  }, [conversationId]);

  useEffect(() => {
    if (
      (transport === "backend_voice" &&
        (backendCallState === "listening" ||
          backendCallState === "agent_speaking" ||
          backendCallState === "ending")) ||
      (transport === "webrtc" && webrtcStatus === "connected")
    ) {
      hadLiveConnectionRef.current = true;
    }
  }, [backendCallState, transport, webrtcStatus]);

  useEffect(() => {
    const wasCallActive = previousIsCallActiveRef.current;
    previousIsCallActiveRef.current = isCallActive;

    if (!wasCallActive || isCallActive || !hadLiveConnectionRef.current) {
      return;
    }

    const estimatedDurationSeconds = elapsedSeconds;
    const estimatedCostCents =
      currentUnitPriceCents != null
        ? Math.round(estimatedDurationSeconds * currentUnitPriceCents)
        : null;

    setPostCallSummary({
      estimatedDurationSeconds,
      estimatedCostCents,
      confirmedDurationSeconds: null,
      confirmedCostCents: null,
      isEstimate: true,
    });
    setPendingSummaryRefresh(true);
    void refreshPostCallSummary(currentConversationIdRef.current);
  }, [
    currentUnitPriceCents,
    elapsedSeconds,
    isCallActive,
    refreshPostCallSummary,
  ]);

  const startCall = useCallback(
    async ({ influencerId, characterId, timezone }: StartAdultCallArgs) => {
      currentInfluencerIdRef.current = influencerId;
      currentConversationIdRef.current = null;
      hadLiveConnectionRef.current = false;
      setElapsedSeconds(0);
      setPostCallSummary(null);
      setPendingSummaryRefresh(false);

      if (transport === "backend_voice") {
        try {
          const response = await chatRepo.getAdultConversationToken(
            influencerId,
            characterId,
          );
          setActiveUnitPriceCents(response.unit_price_cents ?? null);
        } catch {
          setActiveUnitPriceCents(null);
        }
        await startBackendCall({ influencerId, characterId, timezone });
        return;
      }

      setActiveUnitPriceCents(null);
      setWebrtcInfluencerId(influencerId);
      const result = await startConversation({
        flow: "adult-character",
        characterId,
        influencerId,
      });
      if (result?.errorStatus === 402) {
        options?.onInsufficientCredits?.();
      }
    },
    [
      options,
      setWebrtcInfluencerId,
      startBackendCall,
      startConversation,
      transport,
    ],
  );

  const stopCall = useCallback(async () => {
    if (transport === "backend_voice") {
      await stopBackendCall();
      return;
    }
    await stopConversation();
  }, [stopBackendCall, stopConversation, transport]);

  return {
    transport,
    startCall,
    stopCall,
    status,
    error,
    elapsedSeconds,
    conversationId,
    currentUnitPriceCents,
    activeStatusLabel,
    isCallActive,
    postCallSummary,
    pendingSummaryRefresh,
    showPostCallSummary,
    isStartDisabled:
      transport === "backend_voice"
        ? socketStatus === "connecting" || pendingSummaryRefresh
        : webrtcStatus === "connecting" || pendingSummaryRefresh,
  };
}
