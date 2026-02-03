import styles from "./AdultModePage.module.css";
import PlayIcon from "@/assets/svg/Play.svg?react";
import PrimaryButton from "@/ui/components/inputs/buttons/PrimaryButton";
import avatarImage from "@/assets/image/avatar.png";
import clsx from "clsx";
import { InfluencerRepo } from "@/data/repositories/InfluencerRepo";
import { InfluencerSampleModel } from "@/data/models/InfluencerDataModel";
import PricingPlanCard from "@/ui/components/cards/PricingPlanCard";
import { apiClient } from "@/api/apis";
import { useEffect, useMemo, useRef, useState } from "react";
import { SubscriptionsServices } from "@/api/services/SubscriptionsServices";
import { useQuery } from "@tanstack/react-query";
import NormalButton from "@/ui/components/inputs/buttons/NormalButton";
import logger from "@/utils/logger";


const waveformBars = new Array(24).fill(0);
const subscriptionSvc = SubscriptionsServices(apiClient);

type AdultModePageProps = {
  nobg?: boolean;
  onSubscribePressed: () => void;
  influencerId: string;
  influencerImageUrl: string | null;
  influencerName: string | null;
  onBackClicked: () => void;
};

const AdultModePage = ({
  nobg,
  onSubscribePressed,
  influencerId,
  influencerImageUrl,
  influencerName,
  onBackClicked
}: AdultModePageProps) => {
  const influencerRepo = useMemo(() => InfluencerRepo(), []);
  const [samples, setSamples] = useState<InfluencerSampleModel[]>([]);
  const [samplesError, setSamplesError] = useState<string | null>(null);
  const [isLoadingSamples, setIsLoadingSamples] = useState(false);
  const [playingId, setPlayingId] = useState<string | number | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);


  const { data: plansData, isLoading: loadingPlan } =
    useQuery({
      queryKey: ["subscriptionPlans"],
      queryFn: () => subscriptionSvc.getPlans(),
      staleTime: Infinity
    })
  const basicPlan = plansData?.recurring.find((p) => p.id === 1);
  const [subscribing, setSubscribing] = useState(false);

  const handleSubscribe = async () => {
    if (!influencerId || subscribing) return;
    setSubscribing(true);
    try {
      const startResponse = await subscriptionSvc.startSubscription(influencerId, 1);
      const orderId =
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `order_${Date.now()}_${Math.random().toString(16).slice(2)}`;
      const subscriptionId = startResponse?.subscription_id ?? startResponse?.subscriptionId;
      const amountCents = basicPlan?.price_cents ?? 10000;

      if (!subscriptionId) {
        throw new Error("Missing subscription ID from start response");
      }

      await subscriptionSvc.captureSubscription(String(subscriptionId), orderId, amountCents);
      await subscriptionSvc.activateMySubscriptionForInfluencer(influencerId, true);
      onSubscribePressed();
    } catch (err) {
      logger.error("Error during subscription process:", err);
    } finally {
      setSubscribing(false);
    }
  };

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
    <div className={clsx(styles.container, nobg && styles.nobg)}>
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
            <div className={styles.audioRow}>No samples available for {influencerName}</div>
          )}
          {samples.map((sample, index) => {
            const label =
              sample.original_filename?.trim() ||
              `${influencerName || "Influencer"} Sample ${String(index + 1).padStart(2, "0")}`;
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
          <div className={styles.plansSection}>
            <PricingPlanCard
              title={loadingPlan ? "Loading.." : basicPlan?.name ?? "unknown plan"}
              price={basicPlan ? basicPlan.price_display : ""}
              callTime={`${basicPlan?.features?.minutes_equivalent ?? 0} mins`}
              onClick={() => { }}
            />
            <div><span className={styles.headerAccent}>18+</span>only</div>
          </div>
          <p className={styles.tagline}>Let&apos;s heat things up...</p>

          <div className={styles.subscribeButton}>
            <PrimaryButton text={basicPlan ? `Subscribe for $${(basicPlan.price_cents / 100).toFixed(2)}` : "Subscribe"} onClick={onSubscribePressed} variant="purple" />
          </div>

          <div className={styles.footer}>
            You will be charged, your subscription will auto-renew for the same price and package length until you cancel via account settings, and you agree to our Terms.
            <br />
            <NormalButton type="nobg" text="No thank you, take me back" onClick={onBackClicked} />
          </div>
        </div>
      </div>
      <audio ref={audioRef} onEnded={() => setPlayingId(null)} />
    </div>
  );
};

export default AdultModePage;
