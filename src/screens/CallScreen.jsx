import axios from "axios";
import React, { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import avatar from "../assets/image/avatar.png";
import BackgroundGradient from "../components/BackgroundGradient";
import "./CallScreen.css";

const ELEVENLABS_API_KEY =
  "sk_a883dc5b73fefbdf423b935034b9b114274230c25c190c7e";
const VOICE_ID = "DswtmHtPzq8X3yycrmVL";

export default function CallScreen() {
  const navigate = useNavigate();
  const { conversation_id } = useParams();

  const [callStatus, setCallStatus] = useState("Calling...");
  const [callTime, setCallTime] = useState(0);
  const ringtoneRef = useRef(new Audio("/audio/ringtone.wav")); // ✅ Corrigido aqui!
  const audioRef = useRef(new Audio());

  useEffect(() => {
    const ringtone = ringtoneRef.current;
    ringtone.loop = true;

    ringtone.play().catch((err) => {
      console.error("Ringtone playback failed:", err);
    });

    const timer = setTimeout(() => {
      ringtone.pause();
      ringtone.currentTime = 0;

      setCallStatus("Connected");
      playAudio(
        "Hey Glauco! Get ready for more innovation. You know, I was starting to wonder if you’d actually call or just keep chatting forever. Anyway, how’s your day going so far? Anything special you wanna talk about, or should I pick something more interesting for us?"
      );
    }, 3000);

    return () => {
      clearTimeout(timer);
      ringtone.pause();
      ringtone.currentTime = 0;
    };
  }, []);

  useEffect(() => {
    let interval;
    if (callStatus === "Connected") {
      interval = setInterval(() => setCallTime((prev) => prev + 1), 1000);
    }
    return () => clearInterval(interval);
  }, [callStatus]);

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60)
      .toString()
      .padStart(2, "0");
    const secs = (seconds % 60).toString().padStart(2, "0");
    return `${mins}:${secs}`;
  };

  const playAudio = async (text) => {
    try {
      const response = await axios.post(
        `https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}`,
        { text, model_id: "eleven_multilingual_v2" },
        {
          headers: {
            "xi-api-key": ELEVENLABS_API_KEY,
            "Content-Type": "application/json",
          },
          responseType: "blob",
        }
      );

      const audioUrl = URL.createObjectURL(
        new Blob([response.data], { type: "audio/mpeg" })
      );
      const audio = audioRef.current;
      audio.src = audioUrl;
      audio.play();
    } catch (error) {
      console.error("Erro ao gerar áudio:", error);
    }
  };

  const endCall = () => {
    ringtoneRef.current.pause();
    ringtoneRef.current.currentTime = 0;
    audioRef.current.pause();
    audioRef.current.currentTime = 0;
    navigate(`/chat/${conversation_id}`);
  };

  return (
    <div className="call-container">
      <BackgroundGradient />
      <div className="call-content">
        <img src={avatar} alt="AI Avatar" className="call-avatar" />
        <h2 className="call-name">Olivia F. (AI)</h2>
        <p className="call-status">{callStatus}</p>
        {callStatus === "Connected" && (
          <p className="call-time">{formatTime(callTime)}</p>
        )}

        <div className="call-actions">
          <button className="call-action-btn mute-btn">🔇</button>
          <button className="call-action-btn video-btn">🎥</button>
          <button className="call-action-btn speaker-btn">🔈</button>
        </div>

        <button className="end-call-btn" onClick={endCall}>
          📞 End Call
        </button>
      </div>
    </div>
  );
}
