import { useEffect, useState } from "react";
import styles from "./AdultSceneSelectorCard.module.css";
import LottieAnimation from "@/ui/components/LottieAnimation";

type Props = {
  name: string;
  default?: boolean;
  description: string;
  imageSmallSrc: string | null;
  imageLargeSrc: string | null;
  titlePlaceholderData: unknown | null;
};

export default function AdultSceneSelector({
  name,
  description,
  imageSmallSrc,
  imageLargeSrc,
  titlePlaceholderData,
  default: isDefault = false
}: Props) {
  const [imageFailed, setImageFailed] = useState(false);
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
        <div className={styles.imageArea}>
          {!isDefault && titlePlaceholderData != null ? (
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
      <div className={styles.name}>{name}</div>
      <div className={styles.lowerBody}>
        <div className={styles.description}>{description}</div>
      </div>
    </div>
  );
}
