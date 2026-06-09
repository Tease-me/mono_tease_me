import React, { HTMLAttributes } from 'react';
import styles from "./BalanceView.module.css"

interface BalanceViewProps extends HTMLAttributes<HTMLAnchorElement> {
    label: string;
    value: string;
}
const BalanceView: React.FC<BalanceViewProps> = ({ label, value }) => {
    return (
        <div className={styles["card"]}>
            <div className={styles["label"]}>
                {label}
            </div>
            <div className={styles["value"]}>
                {value}
            </div>
        </div>
    );
};

export default BalanceView;