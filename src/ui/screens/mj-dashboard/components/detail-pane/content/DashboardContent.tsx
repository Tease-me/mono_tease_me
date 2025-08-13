import React from 'react';
import styles from "./DashboardContent.module.css"

interface DashboardContentProps {
}

const DashboardContent: React.FC<DashboardContentProps> = ({ }) => {
    return (
        <div className={styles["dashboard-content"]}>
            <h1>DashboardContent</h1>
        </div>
    );
};

export default DashboardContent;