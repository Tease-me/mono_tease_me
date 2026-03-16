import styles from "./AdultSceneSelectorCard.module.css";

type Props = {
  name: string;
  title?: string;
  description: string;
  imageSrc: string;
};

export default function AdultSceneSelector({
  name,
  title,
  description,
  imageSrc
}: Props) {
  return (
    <div className={styles.card}>
      <div className={styles.upperBody}>
        <div className={styles.slickTitle}>{title ?? name}</div>
        <div className={styles.imageArea}>
          <img src={imageSrc} alt={name} className={styles.image} />
        </div>
      </div>
      <div className={styles.title}>{name}</div>
      <div className={styles.lowerBody}>
        <div className={styles.description}>{description}</div>
      </div>
    </div>
  );
}
