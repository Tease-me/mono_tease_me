import { BLAND_API_KEY } from "@/api/env";
import LoadingSpinner from "@/ui/components/loading/LoadingSpinner";
import ProfileMedia from "@/ui/components/ProfileMedia";

import { BlandWebClient } from "bland-client-js-sdk";
import { useCallback, useEffect, useRef, useState } from "react";
import styles from "./VoiceChat.module.css";

import oliviaImage from "@/assets/image/avatar.png"
import oliviaVideo from "@/assets/video/avatar_video.mp4";
import CircularIconButton from "@/ui/components/buttons/CircularIconButton";
import CloseSquareIcon from "@/assets/CloseSquare.svg?react";
import CallIcon from "@/assets/Call.svg?react";
import WifiIcon from "@/assets/Wifi.svg?react";
import NoSignalIcon from "@/assets/svg/NoSignal.svg"

import TeaseMeIconLight from "@/assets/LogoTeaseMe-Light.svg?react";
import teaseMeIconLight from "@/assets/LogoTeaseMe-Light.svg";
import TeaseMeIconDark from "@/assets/LogoTeaseMeDarkMode.svg?react";
import teaseMeIconDark from "@/assets/LogoTeaseMeDarkMode.svg";
type Message = {
  id: string;
  text: string;
  sender: "user" | "ai";
};

interface VoiceChatProps {
  agentId: string;
}

export default function VoiceChat({ agentId }: VoiceChatProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [status, setStatus] = useState<string>("Idle");
  const [error, setError] = useState<string | null>(null);
  const [audioLevel, setAudioLevel] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(false);
  const clientRef = useRef<BlandWebClient | null>(null);
  const audioLevelIntervalRef = useRef<NodeJS.Timeout>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [callId, setCallId] = useState<string>("");
  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine);

  useEffect(() => {
    const updateStatus = () => setIsOnline(navigator.onLine);
    window.addEventListener("online", updateStatus);
    window.addEventListener("offline", updateStatus);
    return () => {
      window.removeEventListener("online", updateStatus);
      window.removeEventListener("offline", updateStatus);
    };
  }, []);

  const cleanup = useCallback(async () => {
    setIsLoading(true);
    try {
      if (audioLevelIntervalRef.current) {
        clearInterval(audioLevelIntervalRef.current);
        audioLevelIntervalRef.current = null;
      }

      if (clientRef.current) {
        clientRef.current.stopConversation();
        clientRef.current = null;
      }
    } catch (err) {
      console.error("Error during cleanup:", err);
      setError(err instanceof Error ? err.message : "Cleanup failed");
    } finally {
      setIsConnected(false);
      setIsRecording(false);
      setStatus("Disconnected");
      setCallId("");
      setAudioLevel(0);
      setIsLoading(false);
    }
  }, []);

  const handleVoiceToggle = async () => {
    if (isRecording) {
      setStatus("Disconnecting...");
      await cleanup();
    } else {
      initVoiceChat();
    }
  };

  useEffect(() => {
    return () => {
      if (isConnected) {
        cleanup();
      }
    };
  }, [isConnected, cleanup]);

  const initVoiceChat = async () => {
    if (!agentId) {
      setError("Agent ID is not set");
      return;
    }

    cleanup();
    setStatus("Initializing...");
    setError(null);
    setIsLoading(true);

    try {
      const response = await fetch(
        `https://api.bland.ai/v1/agents/${agentId}/authorize`,
        {
          method: "POST",
          headers: { Authorization: BLAND_API_KEY ?? "" },
        }
      );
      console.log("Response from /api/getToken:", response);
      const data = await response.json();

      if (!data.token) {
        throw new Error("No token received");
      }

      setStatus("Connecting to Bland AI...");
      clientRef.current = new BlandWebClient(agentId, data.token);

      const currentCallId = Date.now().toString();
      await clientRef.current.initConversation({
        sampleRate: 44100,
        callId: currentCallId,
      });

      setCallId(currentCallId);
      setStatus("Connected! Start speaking...");
      setIsRecording(true);
      setIsConnected(true);

      audioLevelIntervalRef.current = setInterval(() => {
        setAudioLevel(Math.random());
      }, 100);
    } catch (err) {
      console.error("Voice chat error:", err);
      setError(
        err instanceof Error ? err.message : "Failed to connect to voice chat"
      );
      setStatus("Error connecting");
      setIsRecording(false);
      cleanup();
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={styles["main-container"]}>
      <div className={styles["voice-chat-header"]}>
        <ProfileMedia mediaType='video' imageSrc={oliviaImage} videoSrc={oliviaVideo} showHearts size="xlarge" active />
        <div>
          <span className="flex items-center gap-3 w-full justify-center">
            Olivia F.
            {isLoading && (
              <LoadingSpinner className="h-4 w-4 animate-spin text-white/70" />
            )}
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
  );
}
