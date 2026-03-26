import { useEffect, useState } from "react";
import styles from "./AdultSceneSelectorCard.module.css";
import LottieAnimation from "@/ui/components/LottieAnimation";
import AudioSamplePlayer from "@/ui/components/audio-player/AudioSamplePlayer";

type Props = {
  name: string;
  description: string;
  imageSmallSrc: string | null;
  imageLargeSrc: string | null;
  titlePlaceholderData: unknown | null;
  isRelationship?: boolean;
  samples?: { normal: string[]; explicit: string[] };
  ageVerified?: boolean;
  onLockedClick?: () => void;
};

export default function AdultSceneSelector({
  name,
  description,
  imageSmallSrc,
  imageLargeSrc,
  titlePlaceholderData,
  isRelationship,
  samples,
  ageVerified = false,
  onLockedClick,
}: Props) {
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
        <div className={`${styles.imageArea}${isRelationship ? ` ${styles.relationship}` : ""}`}>
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
      <div className={`${styles.name}${isRelationship ? ` ${styles.relationshipName}` : ""}`}>{name}</div>
      <div className={styles.lowerBody}>
        <div className={styles.description}>{description}</div>
        {hasSamples && (
          <div className={styles.samplesList}>
            {normalUrl && (
              <AudioSamplePlayer url={normalUrl} size="small" />
            )}
            {explicitUrl && (
              <AudioSamplePlayer url={explicitUrl} size="small" isExplicit={!ageVerified} onLockedClick={onLockedClick} />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
