import styles from "../VipScreen.module.css";

type VipAvatarStepProps = {
  onBack: () => void;
};

export default function VipAvatarStep({ onBack }: VipAvatarStepProps) {
  return (
    <div className={styles.formPanel}>
      <h1 className={styles.formTitle}>Complete your invite</h1>
      <button className={styles.loginButton} onClick={onBack}>
        Back
      </button>
    </div>
  );
}
