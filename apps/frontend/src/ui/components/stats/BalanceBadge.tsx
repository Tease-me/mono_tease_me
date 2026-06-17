import styles from "./BalanceBadge.module.css";
import clsx from "clsx";
import CreditDisplay from "./CreditDisplay";

type BalanceBadgeProps = {
  balance: number;
  animateValue?: boolean;
};

export default function BalanceBadge({
  balance,
  animateValue = false,
}: BalanceBadgeProps) {
  const noBalance = balance <= 0;

  return (
    <div
      className={clsx(styles.balanceBadge, {
        [styles.noBalance]: noBalance,
        [styles.hasBalance]: !noBalance,
      })}
    >
      <CreditDisplay credits={balance} animateValue={animateValue} />
    </div>
  );
}
