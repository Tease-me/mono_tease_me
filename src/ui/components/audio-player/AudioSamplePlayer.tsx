import React, { useRef, useState } from "react";

const DotLottieWC = "dotlottie-wc" as unknown as React.ComponentType<{ src?: string; speed?: string; mode?: string; loop?: boolean; autoplay?: boolean; width?: string }>;
import PlayIcon from "@/assets/svg/Play.svg?react";
import PauseIcon from "@/assets/svg/Pause.svg?react";
import hcAudioWave from "@/assets/svg/hcAudioWave.svg";
import unlockLottieUrl from "@/assets/lottie/unlock.lottie?url";
import flameLottieUrl from "@/assets/lottie/flame.lottie?url";
import styles from "./AudioSamplePlayer.module.css";
import clsx from "clsx";

let currentAudio: HTMLAudioElement | null = null;

const BARS_LARGE = new Array(24).fill(0);
const BARS_SMALL = new Array(14).fill(0);

interface AudioSamplePlayerProps {
  url: string;
  size?: "small" | "large";
  disabled?: boolean;
  isExplicit?: boolean;
  onLockedClick?: () => void;
}

export default function AudioSamplePlayer({
  url,
  size = "large",
  disabled = false,
  isExplicit = false,
  onLockedClick,
}: AudioSamplePlayerProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState<string | null>(null);

  const bars = size === "small" ? BARS_SMALL : BARS_LARGE;

  const handleToggle = () => {
    if (!audioRef.current || disabled) return;
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

  if (isExplicit) {
    return (
      <div className={styles.hcContainer} onClick={onLockedClick}>
        <div className={styles.hcTopSection}>
          <div className={styles.hcUnlockContainer}>
            <DotLottieWC src={unlockLottieUrl} speed="1" mode="forward" loop autoplay width="100%" />
          </div>
          <div className={styles.hcTextContainer}>
            <div className={styles.hcAudioWave}>
              <img src={hcAudioWave} alt="" />
            </div>
            <div className={styles.hcFlames}>
              <DotLottieWC src={flameLottieUrl} speed="1" mode="forward" loop autoplay width="100%" />
            </div>
            <div className={styles.hcButton}>
              <p className={styles.hcTitle}>Play Hardcore Sample</p>
            </div>
          </div>
        </div>
        <div className={styles.hcBottomSection}>Verify Age to unlock 18+ Samples</div>
      </div>
    );
  }

  return (
    <div className={clsx(styles.pill, styles[size], disabled && styles.disabled)}>
      <button
        type="button"
        className={styles.playButton}
        onClick={handleToggle}
        aria-label={isPlaying ? "Pause" : "Play"}
        disabled={disabled}
      >
        {isPlaying ? <PauseIcon /> : <PlayIcon />}
      </button>

      <div className={clsx(styles.waveform, styles.waveformPlaying)} aria-hidden="true">
        {bars.map((_, i) => (
          <span key={i} />
        ))}
      </div>

      <span className={styles.duration} aria-hidden={!duration}>
        {duration}
      </span>

      <audio
        ref={audioRef}
        src={url}
        preload="metadata"
        onLoadedMetadata={handleLoadedMetadata}
        onPause={() => setIsPlaying(false)}
        onEnded={() => setIsPlaying(false)}
      />
    </div>
  );
}
