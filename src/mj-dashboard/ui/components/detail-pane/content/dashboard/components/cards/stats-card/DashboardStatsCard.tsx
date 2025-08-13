import React, { HTMLAttributes } from 'react';
import styles from "./DashboardStatsCard.module.css"
import clsx from 'clsx';
import DashboardCard from '../DashboardCard';

interface DashboardStatsCardProps extends HTMLAttributes<HTMLDivElement> {
    title: string;
}

const DashboardStatsCard: React.FC<DashboardStatsCardProps> = ({ title, ...props }) => {
    return (
        <DashboardCard className={clsx(props.className, styles["dashboard-stats-card"])} >
            <div className={styles["title"]}>{title}</div>
            <div className={styles["content"]}>
                {props.children}
            </div>
        </DashboardCard>
    );
};

export default DashboardStatsCard;