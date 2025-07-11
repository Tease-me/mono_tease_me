import { BLAND_API_KEY } from "@/api/env";
import LoadingSpinner from "@/components/loading/LoadingSpinner";
import ProfileMedia from "@/components/ProfileMedia";
import { Card, CardContent, CardHeader, CardTitle } from "@/ui/card";
import { BlandWebClient } from "bland-client-js-sdk";
import { Loader2, Mic, MicOff, WifiOff } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import styles from "./VoiceChat.module.css";

import oliviaImage from "@/assets/image/avatar.png"
import oliviaVideo from "@/assets/video/avatar_video.mp4";
import CircularIconButton from "@/components/buttons/CircularIconButton";
import CloseSquareIcon from "@/assets/CloseSquare.svg?react";

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

  const cleanupWebSocket = async (wsInstance: WebSocket): Promise<void> => {
    if (wsInstance && wsInstance.readyState !== WebSocket.CLOSED) {
      wsInstance.onclose = null;
      wsInstance.onerror = null;
      wsInstance.onmessage = null;
      wsInstance.onopen = null;

      wsInstance.close(1000, "User disconnected");

      await new Promise<void>((resolve) => {
        const checkClosed = setInterval(() => {
          if (wsInstance.readyState === WebSocket.CLOSED) {
            clearInterval(checkClosed);
            resolve();
          }
        }, 50);

        setTimeout(() => {
          clearInterval(checkClosed);
          resolve();
        }, 2000);
      });
    }
  };

  const cleanupMediaStream = (mediaStream: MediaStream) => {
    if (mediaStream?.getTracks) {
      mediaStream.getTracks().forEach((track: MediaStreamTrack) => {
        track.enabled = false;
        track.stop();
      });
    }
  };

  const cleanupAudioContext = async (audioContext: AudioContext | null) => {
    if (!audioContext) return;

    try {
      let state = audioContext.state;

      if (state === "closed") return;

      if (state === "running") {
        try {
          await audioContext.suspend();
          console.log("AudioContext suspended");
        } catch (e: any) {
          if (e.name === "InvalidStateError") {
            console.warn("Tried to suspend already-closed AudioContext.");
          } else {
            throw e;
          }
        }

        state = audioContext.state;
        if (state === "closed") return;
      }

      if (state !== "suspended") {
        try {
          await audioContext.close();
          console.log("AudioContext closed");
        } catch (e: any) {
          if (e.name === "InvalidStateError") {
            console.warn("Tried to close already-closed AudioContext.");
          } else {
            throw e;
          }
        }
      }
    } catch (err) {
      console.warn("Error in cleanupAudioContext:", err);
    }
  };

  const releaseMicrophone = async () => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const audioDevices = devices.filter(
        (device) => device.kind === "audioinput"
      );

      for (const device of audioDevices) {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: { deviceId: device.deviceId },
        });
        stream.getTracks().forEach((track) => {
          track.enabled = false;
          track.stop();
        });
      }
    } catch (err) {
      console.warn("Could not release microphone:", err);
    }
  };

  const cleanup = useCallback(async () => {
    setIsLoading(true);
    try {
      if (audioLevelIntervalRef.current) {
        clearInterval(audioLevelIntervalRef.current);
        audioLevelIntervalRef.current = null;
      }

      if (clientRef.current) {
        try {
          if (typeof (clientRef.current as any).stop === "function") {
            await (clientRef.current as any).stop();
          }

          const wsInstance =
            (clientRef.current as any)._ws ||
            (clientRef.current as any).ws ||
            (clientRef.current as any).webSocket;
          await cleanupWebSocket(wsInstance);

          cleanupMediaStream((clientRef.current as any).mediaStream);

          await cleanupAudioContext((clientRef.current as any).audioContext);

          clientRef.current = null;
        } catch (err) {
          console.error("Error stopping client:", err);
          throw new Error("Failed to disconnect properly");
        }
      }
      await releaseMicrophone();
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

      // Simulate audio levels for visualization
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
        <ProfileMedia mediaType='video' imageSrc={oliviaImage} videoSrc={oliviaVideo} showHearts />
        <div>
          <span className="flex items-center gap-3 w-full justify-center">
            Olivia F.
            {isLoading && (
              <LoadingSpinner className="h-4 w-4 animate-spin text-white/70" />
            )}
          </span>
        </div>
      </div>
      <CardContent className="flex flex-col items-center justify-between h-[300px] px-8">
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
          <CircularIconButton>
            <CloseSquareIcon onClick={handleVoiceToggle} />
          </CircularIconButton>
          {/* <button
            onClick={handleVoiceToggle}
            className={`
              w-24 h-24 rounded-full transition-colors duration-500 
              ${isRecording
                ? "bg-red-500/20 hover:bg-red-500/30"
                : "bg-white/10 hover:bg-white/20"
              } 
              border-none shadow-xl hover:shadow-2xl
              flex items-center justify-center
              group
            `}
            disabled={isLoading}
          >

            {isRecording ? (
              <MicOff className="h-8 w-8 text-red-500 transition-transform duration-300 group-hover:scale-110" />
            ) : (
              <Mic className="h-8 w-8 text-white transition-transform duration-300 group-hover:scale-110" />
            )}
          </button> */}

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
                  <WifiOff className="h-4 w-4" />
                  <span className="text-sm font-light">Ready to start</span>
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
      </CardContent>
    </div>
  );
}
