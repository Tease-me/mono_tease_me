import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ADULT_CALL_TRANSPORT } from "@/constants/featureFlags";
import { apiClient } from "@/api/apis";
import type { LatestAdultCallSummary as UsageLatestAdultCallSummary } from "@/api/models/user";
import { ChatRepository } from "@/data/repositories/ChatRepo";
import { UserServices } from "@/api/services/UserServices";
import type {
  CallBilledEvent,
  LatestAdultCallSummary as NotificationLatestAdultCallSummary,
} from "@/hooks/useNotificationSocket";
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
  estimatedCostCredits: number | null;
  confirmedDurationSeconds: number | null;
  confirmedCostCredits: number | null;
  isEstimate: boolean;
};

const chatRepo = ChatRepository();
const userServices = UserServices(apiClient);
const POST_CALL_SUMMARY_RETRY_DELAYS_MS = [1200, 2500, 5000, 10000];

function summaryMatchesCall(
  summary:
    | UsageLatestAdultCallSummary
    | NotificationLatestAdultCallSummary
    | null
    | undefined,
  endedConversationId: string | null,
) {
  if (!summary) {
    return false;
  }

  if (!endedConversationId) {
    return true;
  }

  if (!("conversation_id" in summary)) {
    return true;
  }

  return summary.conversation_id === endedConversationId;
}

function toConfirmedPostCallSummary(
  summary: {
    duration_seconds: number | null;
    cost_cents: number | null;
    cost_credits: number | null;
  },
): PostCallSummary {
  return {
    estimatedDurationSeconds: null,
    estimatedCostCredits: null,
    confirmedDurationSeconds: summary.duration_seconds ?? null,
    confirmedCostCredits: summary.cost_credits ?? null,
    isEstimate: false,
  };
}

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
  const summarySessionRef = useRef(0);
  const acceptsSummaryUpdatesRef = useRef(false);

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
    async (endedConversationId: string | null, sessionToken: number) => {
      const influencerId = currentInfluencerIdRef.current;
      if (!influencerId) {
        setPendingSummaryRefresh(false);
        return;
      }

      for (const delay of POST_CALL_SUMMARY_RETRY_DELAYS_MS) {
        if (delay > 0) {
          await new Promise((resolve) => window.setTimeout(resolve, delay));
        }

        if (summarySessionRef.current !== sessionToken) {
          return;
        }

        try {
          const usage = await userServices.getUserUsage(influencerId);
          const summary = usage.latest_adult_call_summary;
          if (!summary || !summaryMatchesCall(summary, endedConversationId)) {
            continue;
          }

          if (summarySessionRef.current !== sessionToken) {
            return;
          }

          setPostCallSummary(toConfirmedPostCallSummary(summary));
          setPendingSummaryRefresh(false);
          return;
        } catch {
          continue;
        }
      }

      if (summarySessionRef.current === sessionToken) {
        setPendingSummaryRefresh(false);
      }
    },
    [],
  );

  useEffect(() => {
    const handleNotification = (event: Event) => {
      const detail = (event as CustomEvent<CallBilledEvent>).detail;
      if (detail?.type !== "call_billed") {
        return;
      }

      const influencerId = currentInfluencerIdRef.current;
      if (!influencerId || detail.influencer_id !== influencerId) {
        return;
      }

      if (!acceptsSummaryUpdatesRef.current) {
        return;
      }

      const endedConversationId = currentConversationIdRef.current;
      const summary = detail.latest_adult_call_summary;
      if (!summary || !summaryMatchesCall(summary, endedConversationId)) {
        return;
      }

      setPostCallSummary(toConfirmedPostCallSummary(summary));
      setPendingSummaryRefresh(false);
    };

    window.addEventListener("ws:notification", handleNotification);
    return () => window.removeEventListener("ws:notification", handleNotification);
  }, []);

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

    acceptsSummaryUpdatesRef.current = true;
    setPostCallSummary({
      estimatedDurationSeconds: null,
      estimatedCostCredits: null,
      confirmedDurationSeconds: null,
      confirmedCostCredits: null,
      isEstimate: false,
    });
    const sessionToken = summarySessionRef.current;
    setPendingSummaryRefresh(true);
    void refreshPostCallSummary(currentConversationIdRef.current, sessionToken);
  }, [
    isCallActive,
    refreshPostCallSummary,
  ]);

  const startCall = useCallback(
    async ({ influencerId, characterId, timezone }: StartAdultCallArgs) => {
      summarySessionRef.current += 1;
      currentInfluencerIdRef.current = influencerId;
      currentConversationIdRef.current = null;
      hadLiveConnectionRef.current = false;
      acceptsSummaryUpdatesRef.current = false;
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

  const dismissPostCallSummary = useCallback(() => {
    summarySessionRef.current += 1;
    acceptsSummaryUpdatesRef.current = false;
    setPostCallSummary(null);
    setPendingSummaryRefresh(false);
  }, []);

  return {
    transport,
    startCall,
    stopCall,
    dismissPostCallSummary,
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
