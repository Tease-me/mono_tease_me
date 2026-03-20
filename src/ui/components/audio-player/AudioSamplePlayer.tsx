import { useRef, useState } from "react";

let currentAudio: HTMLAudioElement | null = null;
import PlayIcon from "@/assets/svg/Play.svg?react";
import PauseIcon from "@/assets/svg/Pause.svg?react";
import styles from "./AudioSamplePlayer.module.css";
import clsx from "clsx";

const BARS_LARGE = new Array(24).fill(0);
const BARS_SMALL = new Array(14).fill(0);

interface AudioSamplePlayerProps {
  url: string;
  size?: "small" | "large";
}

export default function AudioSamplePlayer({ url, size = "large" }: AudioSamplePlayerProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState<string | null>(null);

  const bars = size === "small" ? BARS_SMALL : BARS_LARGE;

  const handleToggle = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      if (currentAudio && currentAudio !== audioRef.current) {
        currentAudio.pause();
      }
      currentAudio = audioRef.current;
      audioRef.current.play().catch(() => {});
      setIsPlaying(true);
    }
  };

  const handleLoadedMetadata = () => {
    if (!audioRef.current) return;
    const secs = Math.round(audioRef.current.duration);
    if (isFinite(secs)) {
      setDuration(`${secs}sec`);
    }
  };

  return (
    <div className={clsx(styles.pill, styles[size])}>
      <button
        type="button"
        className={styles.playButton}
        onClick={handleToggle}
        aria-label={isPlaying ? "Pause" : "Play"}
      >
        {isPlaying ? <PauseIcon /> : <PlayIcon />}
      </button>

      <div className={clsx(styles.waveform, isPlaying && styles.waveformPlaying)} aria-hidden="true">
        {bars.map((_, i) => (
          <span key={i} />
        ))}
      </div>

      {duration && <span className={styles.duration}>{duration}</span>}

      <audio
        ref={audioRef}
        src={url}
        onLoadedMetadata={handleLoadedMetadata}
        onPause={() => setIsPlaying(false)}
        onEnded={() => setIsPlaying(false)}
      />
    </div>
  );
}
