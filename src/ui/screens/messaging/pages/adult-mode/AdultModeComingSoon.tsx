import React, { useEffect, useMemo, useRef, useState } from "react";
import styles from "./AdultModeComingSoon.module.css";
import NormalButton from "@/ui/components/inputs/buttons/NormalButton";
import clsx from "clsx";
import PlayIcon from "@/assets/svg/Play.svg?react";
import PauseIcon from "@/assets/svg/Pause.svg?react";
import CheckIcon from "@/assets/svg/Check.svg?react";
import emptyProfile from "@/assets/empty-profile.png";
import { InfluencerRepo } from "@/data/repositories/InfluencerRepo";
import { InfluencerSampleModel } from "@/data/models/InfluencerDataModel";


const waveformBars = new Array(24).fill(0);

interface AdultModeComingSoonProps {
  onBackClicked?: () => void;
  nobg?: boolean;
  influencerId?: string;
  influencerImageUrl?: string | null;
  influencerName?: string | null;
}

const AdultModeComingSoon: React.FC<AdultModeComingSoonProps> = ({
  onBackClicked,
  nobg,
  influencerId,
  influencerImageUrl,
  influencerName,
}) => {

  const FEATURES = [
    "Explicit Ai phone conversations",
    `Integrates interests from ${influencerName || " influencer"}`,
    "Tailored to your relationship",
    "Romantic roleplaying",
  ];

  const influencerRepo = useMemo(() => InfluencerRepo(), []);
  const [samples, setSamples] = useState<InfluencerSampleModel[]>([]);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (!influencerId) return;
    let isMounted = true;
    influencerRepo
      .listSamples(influencerId)
      .then((s) => { if (isMounted) setSamples(s); })
      .catch(() => { });
    return () => { isMounted = false; };
  }, [influencerId, influencerRepo]);

  const handleTogglePlay = (sample: InfluencerSampleModel) => {
    if (!sample.url || !audioRef.current) return;
    const key = sample.s3_key;
    if (playingId === key) {
      audioRef.current.pause();
      setPlayingId(null);
      return;
    }
    if (audioRef.current.src !== sample.url) {
      audioRef.current.src = sample.url;
    }
    audioRef.current.play().catch(() => { });
    setPlayingId(key);
  };

  const resolvedAvatar = influencerImageUrl?.trim() || emptyProfile;

  return (
    <div className={clsx(styles.container, nobg && styles.nobg)}>
      <div className={styles.inner}>
        {/* Frame - header only */}
        <div className={styles.card}>
          <header className={styles.header}>
            <span className={styles.headerAccent}>18+</span> Mode
          </header>
          <p className={styles.comingTitle}>Coming Mid 2026</p>
        </div>

        {/* Content outside frame */}
        <p className={styles.subtitle}>Take your relationship to a whole new level</p>

        <ul className={styles.featureList}>
          {FEATURES.map((f) => (
            <li key={f} className={styles.featureItem}>
              <span className={styles.checkmark}><CheckIcon /></span>
              <span>{f}</span>
            </li>
          ))}
        </ul>

        {samples.length > 0 && (
          <div className={styles.previewSection}>
            <p className={styles.previewLabel}>Tap to listen to a preview</p>
            {samples.map((sample, index) => {
              const isPlaying = playingId === sample.s3_key;
              return (
                <div className={styles.audioRow} key={sample.s3_key || `${sample.id}-${index}`}>
                  <div className={styles.avatar}>
                    <img src={resolvedAvatar} alt={influencerName ?? "Influencer"} />
                  </div>
                  <div className={styles.audioCard}>
                    <div className={styles.audioTitle}>{influencerName ? `${influencerName}'s Audio Sample` : "Audio Sample"} {String(index + 1).padStart(2, "0")}</div>
                    <div className={styles.audioPill}>
                      <button
                        className={styles.playButton}
                        type="button"
                        onClick={() => handleTogglePlay(sample)}
                        disabled={!sample.url}
                        aria-pressed={isPlaying}
                      >
                        {isPlaying ? <PauseIcon /> : <PlayIcon />}
                      </button>
                      <div className={styles.waveform} aria-hidden="true">
                        {waveformBars.map((_, i) => (
                          <span key={`wave-${sample.s3_key ?? sample.id}-${i}`} />
                        ))}
                      </div>
                      <span className={styles.duration}>5sec</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <NormalButton
          type="nobg"
          text="Go back"
          onClick={onBackClicked}
          className={styles.back}
        />
      </div>
      <audio ref={audioRef} onEnded={() => setPlayingId(null)} />
    </div>
  );
};

export default AdultModeComingSoon;
