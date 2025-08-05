import { getSignedUrl } from "@/api/eleven/eleven";
import { useConversation } from "@11labs/react";
import { useRef, useCallback, useState } from "react";
import { useMicrophonePermission } from "./useMicrophonePermission";
import { InfluencerDataModel } from "@/data/models/InfluencerDataModel";

export default function useCall(influencer: InfluencerDataModel) {
    const [status, setStatus] = useState<'connecting' | 'connected' | 'disconnected' | "idle" | 'error'>("idle");
    const { permissionState, requestMicrophonePermission, releaseMicrophonePermission } = useMicrophonePermission();
    const ringtoneRef = useRef(new Audio("/audio/ringtone.wav"));

    const ring = () => {
        const ringtone = ringtoneRef.current;
        ringtone.loop = true;

        ringtone.play().catch((err) => {
            console.error("Ringtone playback failed:", err);
        });
    }

    const stopRing = () => {
        ringtoneRef.current.pause();
        ringtoneRef.current.currentTime = 0;
    }

    const conversation = useConversation({
        onConnect: () => {
            setStatus("connected")
            stopRing();
        },
        onDisconnect: () => {
            setStatus("disconnected")
            console.log("disconnected");
        },
        onError: error => {
            setStatus("error")
            console.log(error);
        },
        onMessage: message => {
            console.log(message);
        },
    });

    async function startConversation() {
        ring();
        const hasPermission = await requestMicrophonePermission();
        if (!hasPermission) {
            alert("No permission");
            return;
        }
        const signedUrl = await getSignedUrl(influencer.id);
        await conversation.startSession({ signedUrl });
    }

    const stopConversation = useCallback(async () => {
        await conversation.endSession();
        releaseMicrophonePermission();
    }, [conversation]);

    return {
        startConversation,
        stopConversation,
        permissionState,
        status
    }
}