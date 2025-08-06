import { InfluencerDataModel } from "@/data/models/InfluencerDataModel";
import { useConversation } from "@11labs/react";
import { useCallback, useRef, useState } from "react";
import { useMicrophonePermission } from "./useMicrophonePermission";

export async function getSignedUrl(influencer_id: string) {
  const response = await fetch(
    `/elevenlabs/signed-url?influencer_id=${influencer_id}`
  );
  if (!response.ok) throw new Error("Failed to get signed URL");
  const { signed_url } = await response.json();
  return signed_url;
}

export default function useCall(influencer: InfluencerDataModel) {
  const [status, setStatus] = useState<
    "connecting" | "connected" | "disconnected" | "idle" | "error"
  >("idle");
  const {
    permissionState,
    requestMicrophonePermission,
    releaseMicrophonePermission,
  } = useMicrophonePermission();
  const ringtoneRef = useRef(new Audio("/audio/ringtone.wav"));

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
      console.log("disconnected");
    },
    onError: (error) => {
      setStatus("error");
      console.log(error);
    },
    onMessage: (message) => {
      console.log(message);
    },
  });

  /* async function startConversation() {
        ring();
        const hasPermission = await requestMicrophonePermission();
        if (!hasPermission) {
            alert("No permission");
            return;
        }
        const signedUrl = await elevenLabsServices.getSignedUrl(influencer.id);
        await conversation.startSession({ signedUrl });
    }*/
  async function startConversation() {
    ring();
    const hasPermission = await requestMicrophonePermission();
    if (!hasPermission) {
      alert("No permission");
      return;
    }
    // CHAMA O SEU BACKEND AGORA!
    const signedUrl = await getSignedUrl(influencer.id);
    if (!signedUrl) {
      alert("Could not get signed url");
      stopRing();
      return;
    }
    const conversationId = await conversation.startSession({ signedUrl });
    console.log(conversationId);
  }

  const stopConversation = useCallback(async () => {
    await conversation.endSession();
    releaseMicrophonePermission();
  }, [conversation]);

  return {
    startConversation,
    stopConversation,
    permissionState,
    status,
  };
}
