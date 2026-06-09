import React, { HTMLAttributes } from 'react';
import styles from "./StatCard.module.css"

interface StatCardProps extends HTMLAttributes<HTMLAnchorElement> {
    label: string;
    value: string;
}

const StatCard: React.FC<StatCardProps> = ({ label, value }) => {
    return (
        <div className={styles["card"]}>
            <div className={styles["value"]}>
                {value}
            </div>
            <div className={styles["label"]}>
                {label}
            </div>
        </div>
    );
};

export default StatCard;