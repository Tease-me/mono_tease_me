const DotLottieWC = "dotlottie-wc" as unknown as React.ComponentType<{
  src?: string;
  speed?: string | number;
  mode?: string;
  loop?: boolean;
  autoplay?: boolean;
  width?: string;
  class?: string;
}>;
import lottieDiamondUrl from "@/assets/lottie/lottieDiamond.lottie?url";
import { formatCredits } from "@/utils/balance_utils";
import RollingNumber from "./RollingNumber";
import styles from "./CreditDisplay.module.css";

type CreditDisplayProps = {
  credits: number | null | undefined;
  className?: string;
  animateValue?: boolean;
};

export default function CreditDisplay({
  credits,
  className,
  animateValue = false,
}: Readonly<CreditDisplayProps>) {
  const numericCredits = Math.max(0, Math.round(credits ?? 0));
  const value = formatCredits(numericCredits);

  return (
    <span
      className={[styles.creditDisplay, className].filter(Boolean).join(" ")}
      aria-label={`${value} credits`}
    >
      <span className={styles.icon} aria-hidden="true">
        <DotLottieWC
          src={lottieDiamondUrl}
          speed={1}
          mode="forward"
          loop
          autoplay
          width="100%"
        />
      </span>
      <span className={styles.value}>
        {animateValue ? (
          <RollingNumber value={numericCredits} className={styles.rollingValue} />
        ) : (
          value
        )}
      </span>
    </span>
  );
}
