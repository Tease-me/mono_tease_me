import clsx from "clsx";
import styles from "./MetricRing.module.css";
import { useEffect, useState } from "react";

type Size = "medium" | "small";

type MetricRingProps = {
  icon: React.ReactNode;
  size?: Size;
  value?: number; // 0–100
  label?: string;
  onClick?: () => void;
};
export default function MetricRing({ icon, size = "medium", value = 100, label, onClick }: MetricRingProps) {
  const clamped = Math.max(0, Math.min(100, value));
  const target = (clamped / 100) * 360;

  const [deg, setDeg] = useState(target);
  const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

  useEffect(() => {
    let raf: number;
    const start = deg;
    const t0 = performance.now();

    const tick = (t: number) => {
      const p = Math.min((t - t0) / 300, 1);
      const eased = easeOutCubic(p);
      setDeg(start + (target - start) * eased);
      if (p < 1) raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target]);

  return (
    <button
      className={clsx(styles.ring, styles[size])}
      type="button"
      onClick={onClick}
      style={{ ["--deg" as any]: `${deg}deg` }}
    >
      <span className={styles.icon}>{icon}</span>
      {label && <span className={styles.label}>{label}</span>}
    </button>
  );
}