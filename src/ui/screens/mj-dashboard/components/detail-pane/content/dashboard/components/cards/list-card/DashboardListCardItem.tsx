import React from 'react';
import styles from "./DashboardListCardItem.module.css"
import SvgPack from '@/utils/SvgPack';

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
                <SvgPack.MoreCircle />
            </div>
        </div>
    );
};

export default DashboardListCardItem;