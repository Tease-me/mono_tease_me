import React, { ReactNode } from 'react';
import styles from "./DashboardStatsCard.module.css"

interface DashboardStatsCardProps {
    title: string;
    children: ReactNode;
}

const DashboardStatsCard: React.FC<DashboardStatsCardProps> = ({ }) => {
    return (
        <div className={styles["dashboard-stats-card"]}>

        </div>
    );
};

export default DashboardStatsCard;