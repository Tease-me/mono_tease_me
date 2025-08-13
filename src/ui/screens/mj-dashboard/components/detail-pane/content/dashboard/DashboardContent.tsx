import React from 'react';
import styles from "./DashboardContent.module.css"
import clsx from 'clsx';

interface DashboardContentProps {
}

const DashboardContent: React.FC<DashboardContentProps> = ({ }) => {
    return (
        <>
            <div className={styles["dashboard-content"]}>
                <div className={styles["stat-section"]}>
                    <div className={clsx(styles.card, styles.chart)}>Chart Section</div>
                    <div className={clsx(styles.card, styles.stats)}>Stats Section</div>
                    <div className={clsx(styles.card, styles.stats)}>Stats Section</div>
                    <div className={clsx(styles.card, styles.stats)}>Stats Section</div>
                    <div className={clsx(styles.card, styles.stats)}>Stats Section</div>
                    <div className={clsx(styles.card, styles.stats)}>Stats Section</div>
                    <div className={clsx(styles.card, styles.list)}>List Section</div>
                    <div className={clsx(styles.card, styles.list)}>List Section</div>
                </div>

                <div className={styles["list-section"]}>
                    <div className={clsx(styles.card, styles.list)}>Chart Section</div>
                    <div className={clsx(styles.card, styles.list)}>Stats Section</div>
                </div>
            </div>
        </>
    );
};

export default DashboardContent;