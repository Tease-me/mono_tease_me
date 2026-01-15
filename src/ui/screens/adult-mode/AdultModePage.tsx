import styles from "./AdultModePage.module.css";
import PlayIcon from "@/assets/svg/Play.svg?react";
import MicrophoneIcon from "@/assets/Microphone.svg?react";
import PrimaryButton from "@/ui/components/inputs/buttons/PrimaryButton";
import avatarImage from "@/assets/image/avatar.png";
import { InfluencerRepo } from "@/data/repositories/InfluencerRepo";
import { InfluencerSampleModel } from "@/data/models/InfluencerDataModel";
import { useEffect, useMemo, useRef, useState } from "react";

const waveformBars = new Array(24).fill(0);

type AdultModePageProps = {
  onSubscribePressed: () => void;
  influencerId?: string;
  influencerImageUrl?: string | null;
};

const AdultModePage = ({
  onSubscribePressed,
  influencerId,
  influencerImageUrl,
}: AdultModePageProps) => {
  const influencerRepo = useMemo(() => InfluencerRepo(), []);
  const [samples, setSamples] = useState<InfluencerSampleModel[]>([]);
  const [samplesError, setSamplesError] = useState<string | null>(null);
  const [isLoadingSamples, setIsLoadingSamples] = useState(false);
  const [playingId, setPlayingId] = useState<string | number | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (!influencerId) return;
    let isMounted = true;
    setIsLoadingSamples(true);
    setSamplesError(null);
    influencerRepo
      .listSamples(influencerId)
      .then((responseSamples) => {
        if (!isMounted) return;
        setSamples(responseSamples);
      })
      .catch((error) => {
        console.error("Failed to load influencer samples", error);
        if (!isMounted) return;
        setSamplesError("Unable to load samples.");
      })
      .finally(() => {
        if (!isMounted) return;
        setIsLoadingSamples(false);
      });
    return () => {
      isMounted = false;
    };
  }, [influencerId, influencerRepo]);

  const handleTogglePlay = (sample: InfluencerSampleModel) => {
    if (!sample.url) return;
    if (!audioRef.current) return;
    if (playingId === sample.id) {
      audioRef.current.pause();
      setPlayingId(null);
      return;
    }
    if (audioRef.current.src !== sample.url) {
      audioRef.current.src = sample.url;
    }
    audioRef.current.play().catch((error) => {
      console.error("Failed to play sample", error);
    });
    setPlayingId(sample.id);
  };

  const resolvedAvatar = influencerImageUrl?.trim() || avatarImage;

  return (
    <div className={styles.container}>
      <div className={styles.innerContainer}>
        <header className={styles.header}>
          <span className={styles.headerAccent}>18+</span> Mode
        </header>

        <section className={styles.card}>
          <div className={styles.avatar}>
            <img src={resolvedAvatar} alt="Influencer avatar" />
          </div>
          <div className={styles.cardText}>
            <div className={styles.title}>Adult Chat</div>
            <p>
              Receive access to more adult conversations including explicit
              messages.
            </p>
          </div>
        </section>

        <section className={styles.audioList}>
          {isLoadingSamples && (
            <div className={styles.audioRow}>Loading samples...</div>
          )}
          {!isLoadingSamples && samplesError && (
            <div className={styles.audioRow}>{samplesError}</div>
          )}
          {!isLoadingSamples && !samplesError && samples.length === 0 && (
            <div className={styles.audioRow}>No samples available.</div>
          )}
          {samples.map((sample, index) => {
            const label =
              sample.original_filename?.trim() ||
              `Audio Sample ${String(index + 1).padStart(2, "0")}`;
            const isPlaying = playingId === sample.id;
            return (
              <div className={styles.audioRow} key={sample.s3_key || `${sample.id}-${index}`}>
                <div className={styles.avatar}>
                  <img src={resolvedAvatar} alt="Influencer avatar" />
                </div>
                <div className={styles.audioCard}>
                  <div className={styles.title}>{label}</div>
                  <div className={styles.audioPill}>
                    <button
                      className={styles.playButton}
                      type="button"
                      onClick={() => handleTogglePlay(sample)}
                      disabled={!sample.url}
                      aria-pressed={isPlaying}
                    >
                      <PlayIcon />
                    </button>
                    <div className={styles.waveform} aria-hidden="true">
                      {waveformBars.map((_, waveIndex) => (
                        <span key={`wave-${sample.s3_key ?? sample.id}-${waveIndex}`} />
                      ))}
                    </div>
                    <span className={styles.duration}>Sample</span>
                  </div>
                </div>
              </div>
            );
          })}
        </section>

        <div className={styles.bottomSection}>
          <p className={styles.tagline}>Let&apos;s heat things up...</p>

          <div className={styles.subscribeButton}>
            <PrimaryButton leftIcon={<MicrophoneIcon />} text="Subscribe" onClick={onSubscribePressed} variant="purple" />
          </div>

          <div className={styles.footer}>
            <p>$99 a month (100mins per month) until cancelled.</p>
            <p className={styles.bonus}>
              Subscribe Today for Early Bird Bonus
              <br />
              Extra 15mins free every month!
            </p>
          </div>
        </div>
      </div>
      <audio ref={audioRef} onEnded={() => setPlayingId(null)} />
    </div>
  );
};

export default AdultModePage;
