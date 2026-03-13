import styles from "./AdultSceneSelectorCard.module.css";


type Props = {
  name: string;
  title?: string;
  description: string;
  imageSrc: string;
};

export default function AdultSceneSelector({
  name,
  description,
  imageSrc,
}: Props) {
  return (
    <div className={styles.card}>

      <div className={styles.upperBody}>
      </div>
      <div className={styles.lowerBody}>
      </div>
    </div>
  );
}