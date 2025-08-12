import React from 'react';
import styles from "./SideBarButton.module.css"
import ArrowRightIcon from "@/assets/mj-dashboard/svg/ArrowRight.svg?react"
import clsx from 'clsx';
import { SideBarItem } from '../../../MJDashboard';

interface SideBarButtonProps {
    item: SideBarItem
}

const SideBarButton: React.FC<SideBarButtonProps> = ({ item }) => {
    return (
        <div className={clsx(styles["sidebar-button"], item.isActive && styles["active"])}>
            <div className={styles["sidebar-button-right"]}>{item.leftIcon} <p>{item.title}</p></div> {item.rightIcon ?? <ArrowRightIcon />}
        </div>
    );
};

export default SideBarButton;