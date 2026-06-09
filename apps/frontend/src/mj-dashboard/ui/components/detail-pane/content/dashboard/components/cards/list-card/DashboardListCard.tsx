import React, { HTMLAttributes } from 'react';
import styles from "./DashboardListCard.module.css"
import DashboardCard from '../DashboardCard';

interface DashboardListCardProps extends HTMLAttributes<HTMLDivElement> {
    title: string;
}

const DashboardListCard: React.FC<DashboardListCardProps> = ({ title, ...props }) => {
    return (
        <DashboardCard className={styles["dashboard-list-card"]}>
            <div className={styles["title"]}>{title}</div>
            <div className={styles["content"]}>
                {props.children}
            </div>
        </DashboardCard>
    );
};

export default DashboardListCard;