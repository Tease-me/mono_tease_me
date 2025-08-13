import React from 'react';
import styles from "./DashboardContent.module.css"
import DashboardCard from './components/DashboardCard';

interface DashboardContentProps {
}

const DashboardContent: React.FC<DashboardContentProps> = ({ }) => {
    return (
        <>
            <div className={styles["dashboard-content"]}>
                <div className={styles["stat-section"]}>
                    <DashboardCard className={styles.chart}>Chart Section</DashboardCard>
                    <DashboardCard>Stats Section</DashboardCard>
                    <DashboardCard>Stats Section</DashboardCard>
                    <DashboardCard>Stats Section</DashboardCard>
                    <DashboardCard>Stats Section</DashboardCard>
                    <DashboardCard>Stats Section</DashboardCard>
                </div>

                <div className={styles["list-section"]}>
                    <DashboardCard >Chart Section</DashboardCard>
                    <DashboardCard >Stats Section</DashboardCard>
                </div>
            </div>
        </>
    );
};

export default DashboardContent;