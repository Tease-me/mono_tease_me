import styles from "./BalanceBadge.module.css";
import clsx from "clsx";
import { formatCredits } from "@/utils/balance_utils";

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
      {formatCredits(balance)}
    </div>
  );
}
