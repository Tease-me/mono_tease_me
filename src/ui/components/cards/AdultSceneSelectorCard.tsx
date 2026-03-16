import { useEffect, useState } from "react";
import clsx from "clsx";
import styles from "./AdultSceneSelectorCard.module.css";
import LottieAnimation from "@/ui/components/LottieAnimation";

type Props = {
  name: string;
  girlfriend?: boolean;
  description: string;
  imageSmallSrc: string;
  imageLargeSrc: string;
  titlePlaceholderData: unknown;
};

export default function AdultSceneSelector({
  name,
  description,
  imageSmallSrc,
  imageLargeSrc,
  titlePlaceholderData,
  girlfriend = false
}: Props) {
  const [imageFailed, setImageFailed] = useState(false);

  useEffect(() => {
    setImageFailed(false);
  }, [imageSmallSrc, imageLargeSrc]);

  return (
    <div className={styles.card}>
      <div className={styles.upperBody}>
        <div className={clsx(styles.imageArea, girlfriend && styles.girlfriend)}>
          <div className={styles.titlePlaceholder} aria-hidden="true">
            <LottieAnimation autoplay loop animationData={titlePlaceholderData} />
          </div>
          {imageFailed ? (
            <div className={styles.imageFallback} aria-hidden="true" />
          ) : (
            <img
              src={imageSmallSrc}
              srcSet={`${imageSmallSrc} 1x, ${imageLargeSrc} 2x`}
              alt={name}
              className={styles.image}
              onError={() => setImageFailed(true)}
            />
          )}
        </div>
      </div>
      <div className={styles.name}>{name}</div>
      <div
        className={clsx(
          styles.lowerBody,
          girlfriend ? styles.lowerBodyGirlfriend : styles.lowerBodyStandard,
        )}
      >
        <div className={styles.description}>{description}</div>
      </div>
    </div>
  );
}
