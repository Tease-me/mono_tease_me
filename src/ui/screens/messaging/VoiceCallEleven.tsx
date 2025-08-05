import React, { useCallback, useEffect, useRef, useState } from 'react';
import styles from "./VoiceCallEleven.module.css"
import BackgroundGradient from '@/ui/templates/BackgroundGradient';
import CenteredLayout from '@/ui/templates/CenteredLayout';
import { useConversation } from "@11labs/react";
import { elevenLabsServices } from '@/api/eleven/eleven';
import ProfileMedia from '@/ui/components/ProfileMedia';
import CircularIconButton from '@/ui/components/inputs/buttons/CircularIconButton';
import oliviaImage from "@/assets/image/avatar.png"
import oliviaVideo from "@/assets/video/avatar_video.mp4";
import CloseSquareIcon from "@/assets/CloseSquare.svg?react";
import CallIcon from "@/assets/Call.svg?react";
import WifiIcon from "@/assets/Wifi.svg?react";
import NoSignalIcon from "@/assets/svg/NoSignal.svg"
import { useMicrophonePermission } from '@/hooks/useMicrophonePermission';
import { useLocation } from 'react-router-dom';

interface VoiceCallElevenProps {
}

const VoiceCallEleven: React.FC<VoiceCallElevenProps> = ({ }) => {
    const [isRecording, setIsRecording] = useState(false);
    const [status, setStatus] = useState<string>("Online");
    const [error, setError] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [isConnected, setIsConnected] = useState(false);
    const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine);
    const [influencerId, setInfluencerId] = useState<string | undefined>()
    const { permissionState, requestMicrophonePermission, releaseMicrophonePermission } = useMicrophonePermission();

    const ringtoneRef = useRef(new Audio("/audio/ringtone.wav"));
    const { state } = useLocation();

    useEffect(() => {
        const { influencer_id } = state as { influencer_id: string };
        setInfluencerId(influencer_id)
    }, [state])

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
            console.log("connected");
            stopRing();
            setIsConnected(true);
            setStatus("Connected");
            setIsRecording(true);
        },
        onDisconnect: () => {
            console.log("disconnected");
            setIsConnected(false);
            setIsRecording(false);
            setStatus("Disconnected");
        },
        onError: error => {
            console.log(error);
            setError("An error occurred during the conversation");
            setIsConnected(false);
            setIsRecording(false);
            setStatus("Error");
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
        const signedUrl = await elevenLabsServices.getSignedUrl(influencerId);
        const conversationId = await conversation.startSession({ signedUrl });
        console.log(conversationId);
    }

    const stopConversation = useCallback(async () => {
        await conversation.endSession();
        releaseMicrophonePermission();
    }, [conversation]);

    const handleVoiceToggle = async () => {
        if (isRecording) {
            setStatus("Disconnecting...");
            stopConversation();
        } else {
            startConversation();
        }
    };

    return (
        <BackgroundGradient>
            <CenteredLayout>
                <div className={styles["main-container"]}>
                    <div className={styles["voice-chat-header"]}>
                        <ProfileMedia mediaType='video' imageSrc={oliviaImage} videoSrc={oliviaVideo} showHearts size="xlarge" active />
                        <div>
                            <span className="flex items-center gap-3 w-full justify-center">
                                Olivia F.
                            </span>
                        </div>
                    </div>
                    <div className="text-center w-full flex flex-col items-center gap-6">
                        <div
                            className={`text-lg font-light transition-colors duration-300 ${isRecording
                                ? "text-white"
                                : isLoading
                                    ? "text-white/70"
                                    : "text-white/50"
                                }`}
                        >
                            {status}
                        </div>

                        <CircularIconButton onClick={handleVoiceToggle} disabled={isLoading} icon={isConnected ? <CloseSquareIcon /> : <CallIcon />} />
                        <div className="h-12 flex items-center justify-center">
                            {isRecording ? (
                                <div className="flex justify-center items-center space-x-1">
                                    {[...Array(12)].map((_, i) => (
                                        <div
                                            key={i}
                                            className="w-1 bg-white/30 rounded-full animate-pulse"
                                            style={{
                                                height: `${Math.max(12, Math.random() * 48)}px`,
                                                animationDelay: `${i * 0.1}s`,
                                                animationDuration: "0.5s",
                                            }}
                                        />
                                    ))}
                                </div>
                            ) : (
                                !isLoading && (
                                    <div className="flex justify-center items-center gap-2 text-white/50">
                                        {isOnline ? <WifiIcon className="h-4 w-4" /> : <NoSignalIcon />}
                                        <span className="text-sm font-light">{isOnline ? "Ready to start" : "No Connection"}</span>
                                    </div>
                                )
                            )}
                        </div>

                        {error && (
                            <div className="text-red-300/90 text-sm bg-red-500/10 p-4 rounded-2xl backdrop-blur-sm">
                                {error}
                            </div>
                        )}
                    </div>
                </div>
            </CenteredLayout>
        </BackgroundGradient>
    );
};

export default VoiceCallEleven;