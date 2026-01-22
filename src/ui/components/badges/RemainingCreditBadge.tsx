import React from "react";
import clsx from "clsx";
import styles from "./RemainingCreditBadge.module.css";

type RemainingCreditBadgeState = "normal" | "error";

interface RemainingCreditBadgeProps {
    value: string | number;
    state?: RemainingCreditBadgeState;
    className?: string;
}

const RemainingCreditBadge: React.FC<RemainingCreditBadgeProps> = ({
    value,
    state = "normal",
    className,
}) => {
    return (
        <div className={clsx(styles.remainingCreditBadge, styles[state], className)}>
            {value}
        </div>
    );
};

export default RemainingCreditBadge;
