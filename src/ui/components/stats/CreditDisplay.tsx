import { Suspense } from "react";
import SvgPack from "@/utils/SvgPack";
import { formatCredits } from "@/utils/balance_utils";
import styles from "./CreditDisplay.module.css";

type CreditDisplayProps = {
  credits: number | null | undefined;
  className?: string;
};

export default function CreditDisplay({
  credits,
  className,
}: Readonly<CreditDisplayProps>) {
  const value = formatCredits(credits);

  return (
    <span
      className={[styles.creditDisplay, className].filter(Boolean).join(" ")}
      aria-label={`${value} credits`}
    >
      <Suspense fallback={null}>
        <SvgPack.CreditDiamond className={styles.icon} aria-hidden="true" />
      </Suspense>
      <span className={styles.value}>{value}</span>
    </span>
  );
}
