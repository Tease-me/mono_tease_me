import React from 'react';
import styles from "./DashboardListCardItem.module.css"

interface DashboardListCardItemProps {
    imgUrl?: string;
    title: string;
    cost?: string
}

const DashboardListCardItem: React.FC<DashboardListCardItemProps> = ({ imgUrl, title, cost }) => {
    return (
        <div className={styles["dashboard-list-card-item"]}>
            <div className={styles["left-side"]}>
                <img src={imgUrl} />
                {title}
            </div>
            <div className={styles["right-side"]}>
                {cost}
            </div>
        </div>
    );
};

export default DashboardListCardItem;