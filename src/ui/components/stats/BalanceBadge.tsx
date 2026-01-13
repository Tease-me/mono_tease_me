import styles from "./BalanceBadge.module.css";
import clsx from "clsx";

type BalanceBadgeProps = {
  balance: number;
};

export default function BalanceBadge({ balance }: BalanceBadgeProps) {
  const noBalance = balance <= 0;

  return (
    <div
      className={clsx(styles.balanceBadge, {
        [styles.noBalance]: noBalance,
        [styles.hasBalance]: !noBalance,
      })}
    >
      ${balance.toFixed(2)}
    </div>
  );
}
