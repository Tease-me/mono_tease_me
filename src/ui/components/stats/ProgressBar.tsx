import clsx from "clsx";
import styles from "./ProgressBar.module.css";
import { ReactNode } from "react";

type ProgressBarProps = {
  label: string;
  value: number;      
  max: number;        
  icon?: ReactNode; 
  compact?: boolean;  
  mutedLabel?: boolean; 
  className?: string;
};

export default function ProgressBar({
  label,
  value,
  max,
  icon,
  compact = false,
  mutedLabel = false,
  className,
}: ProgressBarProps) {
  const pct =value/max * 100;
  const clamped = Math.max(0, Math.min(100, pct));

  return (
    <div className={clsx(styles.wrap, className)}>
      <div className={styles.header}>
        <div className={styles.left}>
          {icon && <span className={styles.icon}>{icon}</span>}
          <span className={clsx(styles.label, mutedLabel && styles.labelMuted)}>
            {label}
          </span>
        </div>
        <span className={styles.value}>{value.toFixed(0)}/{max}</span>
      </div>
      <div className={clsx(styles.track, compact && styles.trackCompact)}>
        <div
          className={clsx(styles.fill, compact && styles.fillCompact)}
          style={{ width: `${clamped}%` }}
        />
      </div>
    </div>
  );
}
