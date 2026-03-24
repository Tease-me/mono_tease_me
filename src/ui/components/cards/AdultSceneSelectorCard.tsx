import { useEffect, useState } from "react";
import { useIsMobile } from "@/hooks/layout/useIsDesktop";
import styles from "./AdultSceneSelectorCard.module.css";
import LottieAnimation from "@/ui/components/LottieAnimation";
import AudioSamplePlayer from "@/ui/components/audio-player/AudioSamplePlayer";

type Props = {
  name: string;
  description: string;
  imageSmallSrc: string | null;
  imageLargeSrc: string | null;
  titlePlaceholderData: unknown | null;
  isGirlfriend?: boolean;
  samples?: { normal: string[]; explicit: string[] };
  ageVerified?: boolean;
};

export default function AdultSceneSelector({
  name,
  description,
  imageSmallSrc,
  imageLargeSrc,
  titlePlaceholderData,
  isGirlfriend,
  samples,
  ageVerified = false,
}: Props) {
  const isMobile = useIsMobile();
  const [imageFailed, setImageFailed] = useState(false);
  const normalUrl = samples?.normal[0] ?? null;
  const explicitUrl = samples?.explicit[0] ?? null;
  const hasSamples = normalUrl !== null || explicitUrl !== null;
  const resolvedImageSrc = imageSmallSrc ?? imageLargeSrc ?? null;
  const resolvedSrcSet =
    resolvedImageSrc && imageLargeSrc
      ? `${resolvedImageSrc} 1x, ${imageLargeSrc} 2x`
      : undefined;

  useEffect(() => {
    setImageFailed(false);
  }, [imageSmallSrc, imageLargeSrc]);

  return (
    <div className={styles.card}>
      <div className={styles.upperBody}>
        <div className={`${styles.imageArea}${isGirlfriend ? ` ${styles.girlfriend}` : ""}`}>
          {titlePlaceholderData != null ? (
            <div className={styles.titlePlaceholder} aria-hidden="true">
              <LottieAnimation autoplay loop animationData={titlePlaceholderData} />
            </div>
          ) : null}
          {imageFailed || !resolvedImageSrc ? (
            <div className={styles.imageFallback} aria-hidden="true" />
          ) : (
            <img
              src={resolvedImageSrc}
              srcSet={resolvedSrcSet}
              alt={name}
              className={styles.image}
              onError={() => setImageFailed(true)}
            />
          )}
        </div>
      </div>
      <div className={`${styles.name}${isGirlfriend ? ` ${styles.girlfriendName}` : ""}`}>{name}</div>
      <div className={styles.lowerBody}>
        <div className={styles.description}>{description}</div>
        {hasSamples && (
          <div className={styles.samplesList}>
            {normalUrl && (
              <AudioSamplePlayer url={normalUrl} size={isMobile ? "small" : "large"} />
            )}
            {explicitUrl && (
              <AudioSamplePlayer url={explicitUrl} size={isMobile ? "small" : "large"} disabled={!ageVerified} />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
