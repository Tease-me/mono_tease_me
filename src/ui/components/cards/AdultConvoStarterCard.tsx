import styles from "./AdultConvoStarterCard.module.css"

type Prop = {
  influencerName: string
};

export default function AdultConvoStarterCard({influencerName}: Prop) {
  return (
    <div className={styles.card}>
      <div className={styles.title}>
        This is the start of your <br/><span className={styles.highlight}>18+</span> conversation
      </div>
      <div className={styles.subtitle}>
        Enjoy explicit conversations sent from {influencerName}
        </div>
    </div>
  )

}