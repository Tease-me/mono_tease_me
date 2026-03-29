import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ADULT_CALL_TRANSPORT } from "@/constants/featureFlags";
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
  } = useAdultVoiceCall({
    onInsufficientCredits: options?.onInsufficientCredits,
  });

  const {
    setInfluencerId: setWebrtcInfluencerId,
    startConversation,
    stopConversation,
    status: webrtcStatus,
    errorMessage: webrtcErrorMessage,
  } = useCallWebRTC({
    onCreditsExpired: options?.onInsufficientCredits,
  });

  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const elapsedIntervalRef = useRef<number | null>(null);

  const transport = ADULT_CALL_TRANSPORT;
  const status = transport === "backend_voice" ? backendStatus : webrtcStatus;
  const error =
    transport === "backend_voice"
      ? backendError
      : webrtcErrorMessage
        ? { code: "WEBRTC_ERROR", message: webrtcErrorMessage }
        : null;

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

  useEffect(() => {
    if (transport !== "webrtc") {
      return;
    }

    setWebrtcInfluencerId(undefined);
  }, [setWebrtcInfluencerId, transport]);

  useEffect(() => {
    if (!isCallActive) {
      setElapsedSeconds(0);
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

  const startCall = useCallback(
    async ({ influencerId, characterId, timezone }: StartAdultCallArgs) => {
      if (transport === "backend_voice") {
        await startBackendCall({ influencerId, characterId, timezone });
        return;
      }

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
    activeStatusLabel,
    isCallActive,
    isStartDisabled:
      transport === "backend_voice"
        ? socketStatus === "connecting"
        : webrtcStatus === "connecting",
  };
}
