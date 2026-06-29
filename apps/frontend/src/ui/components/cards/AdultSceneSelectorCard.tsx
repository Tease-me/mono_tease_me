import { useEffect, useState } from "react";
import styles from "./AdultSceneSelectorCard.module.css";
import LottieAnimation from "@/ui/components/LottieAnimation";
import AudioSamplePlayer from "@/ui/components/audio-player/AudioSamplePlayer";
import type { SceneTitlePlaceholder } from "@/ui/screens/messaging/pages/scene-selector/SceneSelector";

const DotLottieWC = "dotlottie-wc" as unknown as React.ComponentType<{ src?: string; speed?: string; mode?: string; loop?: boolean; autoplay?: boolean; width?: string }>;

type Props = {
  name: string;
  description: string;
  imageSmallSrc: string | null;
  imageLargeSrc: string | null;
  titlePlaceholder: SceneTitlePlaceholder;
  isRelationship?: boolean;
  samples?: { normal: string[]; explicit: string[] };
  ageVerified?: boolean;
  onLockedClick?: () => void;
  preview?: boolean;
  opaque?: boolean;
};

export default function AdultSceneSelector({
  name,
  description,
  imageSmallSrc,
  imageLargeSrc,
  titlePlaceholder,
  isRelationship,
  samples,
  ageVerified = false,
  onLockedClick,
  preview = false,
  opaque = false,
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
    <div className={`${styles.card}${preview ? ` ${styles.previewCard}` : ""}${opaque ? ` ${styles.opaqueCard}` : ""}`}>
      <div className={styles.upperBody}>
        <div className={`${styles.imageArea}${isRelationship ? ` ${styles.relationship}` : ""}`}>
          {titlePlaceholder != null ? (
            <div className={styles.titlePlaceholder} aria-hidden="true">
              {titlePlaceholder.type === "json" ? (
                <LottieAnimation autoplay loop animationData={titlePlaceholder.data} />
              ) : (
                <DotLottieWC src={titlePlaceholder.src} speed="1" mode="forward" loop autoplay width="100%" />
              )}
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
        <div className={`${styles.name}${isRelationship ? ` ${styles.relationshipName}` : ""}`}>{name}</div>
      </div>
      {!preview && <div className={styles.lowerBody}>
        <div className={styles.description}>{description}</div>
        {hasSamples && (
          <div className={`${styles.samplesList}${ageVerified && explicitUrl ? ` ${styles.samplesListNsfw}` : ""}`}>
            {normalUrl && (
              <AudioSamplePlayer url={normalUrl} size="small" variant={isRelationship ? "pink" : "default"} />
            )}
            {explicitUrl && (
              <AudioSamplePlayer
                url={explicitUrl}
                size="small"
                isExplicit={!ageVerified}
                variant={ageVerified ? "nsfw" : isRelationship ? "pink" : "default"}
                onLockedClick={onLockedClick}
              />
            )}
          </div>
        )}
      </div>}
    </div>
  );
}
