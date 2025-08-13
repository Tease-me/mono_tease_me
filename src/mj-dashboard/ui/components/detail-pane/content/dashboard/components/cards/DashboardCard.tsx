import React, { HTMLAttributes } from 'react';
import styles from "./DashboardCard.module.css"
import clsx from 'clsx';

interface DashboardCardProps extends HTMLAttributes<HTMLDivElement> { }

const DashboardCard: React.FC<DashboardCardProps> = ({ ...props }) => {
    return (
        <div {...props} className={clsx(styles["dashboard-card"], props.className)} >
            {props.children}
        </div>
    );
};

export default DashboardCard;