import styles from "./MetricRing.module.css";

type MetricRingProps = {
  icon: React.ReactNode;
  value?: number; // 0–100
  label?: string;
  onClick?: () => void;
};

export default function MetricRing({ icon, value = 100, label, onClick }: MetricRingProps) {
const clamped = Math.max(0, Math.min(100, value));
const deg = `${(clamped / 100) * 360}deg`;

  return (
    <button className={styles.ring} type="button" onClick={onClick} style={{ ["--deg" as any]: deg }}>
      <span className={styles.icon}>{icon}</span>
      {label && <span className={styles.label}>{label}</span>}
    </button>
  );
}
