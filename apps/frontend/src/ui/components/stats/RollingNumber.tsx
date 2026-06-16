import { useEffect, useRef, useState } from "react";
import styles from "./RollingNumber.module.css";

const ZERO_WIDTH = "\u200B";
const ROLL_DIGITS = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"] as const;

function toSize(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 1;
  return value.toString().length;
}

function toDigits(value: number, size: number): string[] {
  const digits = Math.max(0, Math.round(value)).toString().split("");
  const padSize = Math.max(0, size - digits.length);
  return [...Array(padSize).fill(ZERO_WIDTH), ...digits];
}

type RollingDigitProps = {
  digit: string;
  durationMs: number;
};

function RollingDigit({ digit, durationMs }: RollingDigitProps) {
  return (
    <span
      className={styles.digit}
      data-value={digit}
      style={{ "--roll-duration": `${durationMs}ms` } as React.CSSProperties}
    >
      <span className={styles.hiddenValue}>
        {digit === ZERO_WIDTH ? "" : digit}
      </span>
      <span className={styles.scale} aria-hidden="true">
        {ROLL_DIGITS.map((d) => (
          <span key={d}>{d}</span>
        ))}
      </span>
    </span>
  );
}

type RollingNumberProps = {
  value: number;
  durationMs?: number;
  className?: string;
};

export default function RollingNumber({
  value,
  durationMs = 750,
  className,
}: Readonly<RollingNumberProps>) {
  const safeValue = Math.max(0, Math.round(value));
  const [displaySize, setDisplaySize] = useState(() => toSize(safeValue));
  const [renderValue, setRenderValue] = useState(safeValue);
  const sizeRef = useRef(displaySize);

  useEffect(() => {
    const nextSize = toSize(safeValue);

    if (nextSize > sizeRef.current) {
      setDisplaySize(nextSize);
      setRenderValue(Number.NaN);

      const timer = window.setTimeout(() => {
        sizeRef.current = nextSize;
        setRenderValue(safeValue);
      }, 23);

      return () => window.clearTimeout(timer);
    }

    sizeRef.current = nextSize;
    setDisplaySize(nextSize);
    setRenderValue(safeValue);
  }, [safeValue]);

  const digits = toDigits(renderValue, displaySize);

  return (
    <span
      className={[styles.root, className].filter(Boolean).join(" ")}
      aria-hidden="true"
    >
      {digits.map((digit, index) => (
        <RollingDigit
          key={`${displaySize}-${index}`}
          digit={digit}
          durationMs={durationMs}
        />
      ))}
    </span>
  );
}
