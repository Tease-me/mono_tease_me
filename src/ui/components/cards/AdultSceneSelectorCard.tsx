import { useEffect, useState } from "react";
import clsx from "clsx";
import styles from "./AdultSceneSelectorCard.module.css";

type Props = {
  name: string;
  girlfriend?: boolean;
  title?: string;
  description: string;
  imageSrc: string;
};

export default function AdultSceneSelector({
  name,
  title,
  description,
  imageSrc,
  girlfriend = false
}: Props) {
  const [imageFailed, setImageFailed] = useState(false);

  useEffect(() => {
    setImageFailed(false);
  }, [imageSrc]);

  return (
    <div className={styles.card}>
      <div className={styles.upperBody}>
        <div className={styles.slickTitle}>{title ?? name}</div>
        <div className={clsx(styles.imageArea, girlfriend && styles.girlfriend)}>
          {imageFailed ? (
            <div className={styles.imageFallback} aria-hidden="true" />
          ) : (
            <img
              src={imageSrc}
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
