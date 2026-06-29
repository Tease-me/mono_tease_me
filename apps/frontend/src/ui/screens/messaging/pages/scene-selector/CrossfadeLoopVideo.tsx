import { useEffect, useRef, useState, type Ref } from "react";
import styles from "./CrossfadeLoopVideo.module.css";

export type CrossfadeLoopVideoSource = {
  key: string;
  mp4: string | null;
  webm: string | null;
  poster?: string | null;
};

type CrossfadeLoopVideoProps = {
  source: CrossfadeLoopVideoSource;
  className?: string;
  videoClassName?: string;
};

type VideoSlot = CrossfadeLoopVideoSource & {
  visible: boolean;
};

const FADE_MS = 500;
const CROSSFADE_LOAD_TIMEOUT_MS = 4000;

function hasPlayableVideo(source: CrossfadeLoopVideoSource) {
  return Boolean(source.mp4 || source.webm);
}

function sourcesMatch(a: CrossfadeLoopVideoSource, b: CrossfadeLoopVideoSource) {
  return a.key === b.key && a.mp4 === b.mp4 && a.webm === b.webm;
}

function LoopVideo({
  slot,
  videoRef,
  videoClassName,
}: {
  slot: VideoSlot;
  videoRef?: Ref<HTMLVideoElement>;
  videoClassName?: string;
}) {
  if (!slot.mp4 && !slot.webm) {
    return null;
  }

  return (
    <video
      ref={videoRef}
      key={slot.key}
      poster={slot.poster ?? undefined}
      className={`${styles.video} ${videoClassName ?? ""} ${slot.visible ? styles.videoVisible : styles.videoHidden}`}
      autoPlay
      loop
      muted
      playsInline
    >
      {slot.webm && <source src={slot.webm} type="video/webm" />}
      {slot.mp4 && <source src={slot.mp4} type="video/mp4" />}
    </video>
  );
}

export default function CrossfadeLoopVideo({
  source,
  className,
  videoClassName,
}: CrossfadeLoopVideoProps) {
  const displayedSourceRef = useRef(source);
  const [primary, setPrimary] = useState<VideoSlot>({
    ...source,
    visible: true,
  });
  const [secondary, setSecondary] = useState<VideoSlot | null>(null);
  const secondaryVideoRef = useRef<HTMLVideoElement>(null);
  const fadeTimeoutRef = useRef<number | null>(null);
  const pendingSourceRef = useRef<CrossfadeLoopVideoSource | null>(null);
  const slotsRef = useRef({ primary, secondary });

  useEffect(() => {
    slotsRef.current = { primary, secondary };
  }, [primary, secondary]);

  const clearFadeTimeout = () => {
    if (fadeTimeoutRef.current !== null) {
      window.clearTimeout(fadeTimeoutRef.current);
      fadeTimeoutRef.current = null;
    }
  };

  useEffect(() => clearFadeTimeout, []);

  useEffect(() => {
    if (sourcesMatch(displayedSourceRef.current, source)) {
      return;
    }

    if (pendingSourceRef.current && sourcesMatch(pendingSourceRef.current, source)) {
      return;
    }

    clearFadeTimeout();

    if (!hasPlayableVideo(source)) {
      pendingSourceRef.current = null;
      displayedSourceRef.current = source;
      setSecondary(null);
      setPrimary({ ...source, visible: true });
      return;
    }

    pendingSourceRef.current = source;
    const { primary: currentPrimary, secondary: currentSecondary } = slotsRef.current;
    const visibleLayer =
      currentSecondary?.visible && hasPlayableVideo(currentSecondary)
        ? currentSecondary
        : currentPrimary;
    setPrimary({ ...visibleLayer, visible: true });
    setSecondary({ ...source, visible: false });
  }, [source]);

  useEffect(() => {
    const pending = pendingSourceRef.current;
    const video = secondaryVideoRef.current;
    if (!pending || !secondary || secondary.visible || !video) {
      return;
    }

    const commitCrossfade = () => {
      void video.play().catch(() => undefined);

      setPrimary((current) => ({ ...current, visible: false }));
      setSecondary((current) => (current ? { ...current, visible: true } : null));

      clearFadeTimeout();
      fadeTimeoutRef.current = window.setTimeout(() => {
        const next = pendingSourceRef.current;
        if (!next) {
          return;
        }
        displayedSourceRef.current = next;
        setPrimary({ ...next, visible: true });
        setSecondary(null);
        pendingSourceRef.current = null;
        fadeTimeoutRef.current = null;
      }, FADE_MS);
    };

    let committed = false;
    const commitOnce = () => {
      if (committed) {
        return;
      }
      committed = true;
      commitCrossfade();
    };

    const handleCanPlay = () => {
      commitOnce();
    };

    const handleError = () => {
      commitOnce();
    };

    video.load();
    if (video.readyState >= HTMLMediaElement.HAVE_FUTURE_DATA) {
      commitOnce();
      return;
    }

    video.addEventListener("canplay", handleCanPlay, { once: true });
    video.addEventListener("error", handleError, { once: true });
    const timeoutId = window.setTimeout(commitOnce, CROSSFADE_LOAD_TIMEOUT_MS);
    return () => {
      video.removeEventListener("canplay", handleCanPlay);
      video.removeEventListener("error", handleError);
      window.clearTimeout(timeoutId);
    };
  }, [secondary]);

  if (!primary.mp4 && !primary.webm) {
    return null;
  }

  return (
    <div className={`${styles.stack} ${className ?? ""}`}>
      <LoopVideo slot={primary} videoClassName={videoClassName} />
      {secondary && (
        <LoopVideo
          slot={secondary}
          videoRef={secondaryVideoRef}
          videoClassName={videoClassName}
        />
      )}
    </div>
  );
}
