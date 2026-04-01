import React, { useRef, useState, useEffect, useCallback } from "react";

const DotLottieWC = "dotlottie-wc" as unknown as React.ComponentType<{ src?: string; speed?: string; mode?: string; loop?: boolean; autoplay?: boolean; width?: string }>;
import PlayIcon from "@/assets/svg/Play.svg?react";
import PauseIcon from "@/assets/svg/Pause.svg?react";
import hcAudioWave from "@/assets/svg/hcAudioWave.svg";
import unlockLottieUrl from "@/assets/lottie/unlock.lottie?url";
import flameLottieUrl from "@/assets/lottie/flame.lottie?url";
import lottieFlameUrl from "@/assets/lottie/lottieFlame.lottie?url";
import styles from "./AudioSamplePlayer.module.css";
import clsx from "clsx";

let currentAudio: HTMLAudioElement | null = null;

interface AudioSamplePlayerProps {
  url: string;
  size?: "small" | "large";
  disabled?: boolean;
  isExplicit?: boolean;
  variant?: "default" | "pink" | "nsfw";
  onLockedClick?: () => void;
}

export default function AudioSamplePlayer({
  url,
  size = "large",
  disabled = false,
  isExplicit = false,
  variant = "default",
  onLockedClick,
}: AudioSamplePlayerProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animFrameRef = useRef<number>(0);
  const [canvasReady, setCanvasReady] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);

  const canvasCallbackRef = useCallback((node: HTMLCanvasElement | null) => {
    canvasRef.current = node;
    setCanvasReady(!!node);
  }, []);
  const [duration, setDuration] = useState<string | null>(null);
  const [peaks, setPeaks] = useState<number[]>([]);

  useEffect(() => {
    if (!url) return;
    const controller = new AbortController();
    let audioCtx: AudioContext | null = null;

    (async () => {
      try {
        const res = await fetch(url, { signal: controller.signal });
        const buffer = await res.arrayBuffer();
        audioCtx = new AudioContext();
        const audioBuffer = await audioCtx.decodeAudioData(buffer);
        const raw = audioBuffer.getChannelData(0);
        const samples = 60;
        const block = Math.floor(raw.length / samples);
        const data: number[] = [];
        for (let i = 0; i < samples; i++) {
          let sum = 0;
          for (let j = 0; j < block; j++) sum += Math.abs(raw[i * block + j]);
          data.push(sum / block);
        }
        const max = Math.max(...data);
        setPeaks(data.map((n) => n / max));
      } catch (e: any) {
        if (e?.name === "AbortError") return;
      } finally {
        audioCtx?.close();
      }
    })();

    return () => controller.abort();
  }, [url]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || peaks.length === 0) return;

    const draw = () => {
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      const w = canvas.width;
      const h = canvas.height;
      ctx.clearRect(0, 0, w, h);

      const gap = 2;
      const barW = (w - (peaks.length - 1) * gap) / peaks.length;
      const minBarH = 2;

      // unplayed — white translucent
      peaks.forEach((val, i) => {
        const barH = Math.max(val * h * 0.85, minBarH);
        const x = i * (barW + gap);
        ctx.fillStyle = "rgba(255,255,255,0.7)";
        ctx.beginPath();
        ctx.roundRect(x, (h - barH) / 2, barW, barH, barW / 2);
        ctx.fill();
      });

      // played — white
      const audio = audioRef.current;
      const playedWidth =
        audio && audio.duration
          ? (audio.currentTime / audio.duration) * w
          : 0;

      if (playedWidth > 0) {
        ctx.save();
        ctx.beginPath();
        ctx.rect(0, 0, playedWidth, h);
        ctx.clip();
        peaks.forEach((val, i) => {
          const barH = Math.max(val * h * 0.85, minBarH);
          const x = i * (barW + gap);
          ctx.fillStyle = "rgba(255,255,255,0.95)";
          ctx.beginPath();
          ctx.roundRect(x, (h - barH) / 2, barW, barH, barW / 2);
          ctx.fill();
        });
        ctx.restore();
      }

      animFrameRef.current = requestAnimationFrame(draw);
    };

    draw();
    return () => cancelAnimationFrame(animFrameRef.current);
  }, [peaks, canvasReady]);

  const handleToggle = () => {
    if (!audioRef.current || disabled) return;
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      if (currentAudio && currentAudio !== audioRef.current) {
        currentAudio.pause();
      }
      currentAudio = audioRef.current;
      audioRef.current.play().catch(() => { });
      setIsPlaying(true);
    }
  };

  const handleLoadedMetadata = () => {
    if (!audioRef.current) return;
    const secs = Math.round(audioRef.current.duration);
    if (isFinite(secs)) setDuration(`${secs}sec`);
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
    <div className={clsx(styles.pill, styles[size], styles[variant], disabled && styles.disabled)}>
      <button
        type="button"
        className={styles.playButton}
        onClick={handleToggle}
        aria-label={isPlaying ? "Pause" : "Play"}
        disabled={disabled}
      >
        {isPlaying ? <PauseIcon /> : <PlayIcon />}
      </button>

      <canvas
        ref={canvasCallbackRef}
        className={styles.waveformCanvas}
        width={200}
        height={size === "small" ? 28 : 36}
        aria-hidden="true"
      />

      <span className={styles.duration} aria-hidden={!duration}>
        {duration}
      </span>

      {variant === "nsfw" && (
        <div className={styles.nsfwLabel}>
          <div className={styles.nsfwLottie}>
            <DotLottieWC src={lottieFlameUrl} speed="1" mode="forward" loop autoplay width="100%" />
          </div>
          <span className={styles.nsfwLabelText}>NSFW</span>
        </div>
      )}

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
