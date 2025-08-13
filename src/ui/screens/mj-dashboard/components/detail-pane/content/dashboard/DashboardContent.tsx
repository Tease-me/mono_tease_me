import React from 'react';
import styles from "./DashboardContent.module.css"
import DashboardCard from './components/DashboardCard';
import DashboardStatsCard from './components/stats-card/DashboardStatsCard';

interface DashboardContentProps {
}

const DashboardContent: React.FC<DashboardContentProps> = ({ }) => {
    return (
        <>
            <div className={styles["dashboard-content"]}>
                <div className={styles["stat-section"]}>
                    <DashboardStatsCard title='Earning Data' className={styles.chart}>Chart Section</DashboardStatsCard>
                    <DashboardStatsCard title='Total Users'>123</DashboardStatsCard>
                    <DashboardStatsCard title='Total New Users'>3</DashboardStatsCard>
                    <DashboardStatsCard title='Total Influencers'>5</DashboardStatsCard>
                    <DashboardStatsCard title='Total Issues Reported'>3</DashboardStatsCard>
                    <DashboardStatsCard title='Total Chats'>150</DashboardStatsCard>
                </div>

                <div className={styles["list-section"]}>
                    <DashboardCard>Top Influencer Earners</DashboardCard>
                    <DashboardCard>Top Users Spend</DashboardCard>
                </div>
            </div>
        </>
    );
};

export default DashboardContent;