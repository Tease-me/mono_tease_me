import clsx from "clsx";
import type { FC } from "react";
import styles from "./PricingPlanCard.module.css";

type PricingPlanCardProps = {
  title: string;
  price: string;
  callTime: string;
  active?: boolean;
  onClick: () => void;
};

const PricingPlanCard: FC<PricingPlanCardProps> = ({
  title,
  price,
  callTime,
  active = false,
  onClick
}) => {
  return (
    <div className={clsx(styles.card, active && styles.activeCard)} onClick={onClick}>
      <div className={clsx(styles.headerArea, active && styles.activeHeaderArea)}>
        <div className={styles.title}>{title}</div>
      </div>
      <div className={clsx(styles.mainArea, active && styles.activeMainArea)}>
        <div className={styles.price}>{price}</div>
        <div className={styles.callTimeArea}>{callTime}<span className={styles.grayed}> / Call time</span></div>
      </div>
    </div>
  );
};

export default PricingPlanCard;
