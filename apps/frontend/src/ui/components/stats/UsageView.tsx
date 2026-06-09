
import clsx from "clsx";
import styles from "./UsageView.module.css";

type Props = {
  value: string;
  label: string;
  tone?: "green" | "purple";
  className?: string;
};

export default function UsageView({ value, label, tone = "green", className }: Props) {
  return (
    <div className={clsx(styles.box, tone === "green" ? styles.green : styles.purple, className)}>
      <div className={styles.value}>{value}</div>
      <div className={styles.label}>{label}</div>
    </div>
  );
}
