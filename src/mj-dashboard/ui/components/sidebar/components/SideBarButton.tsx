import React, { HTMLAttributes } from 'react';
import styles from "./SideBarButton.module.css"
import ArrowRightIcon from "@/assets/mj-dashboard/svg/ArrowRight.svg?react"
import clsx from 'clsx';
import { SideBarItem } from '../../../MJDashboard';

interface SideBarButtonProps extends HTMLAttributes<HTMLDivElement> {
    item: SideBarItem
}

const SideBarButton: React.FC<SideBarButtonProps> = ({ item, ...props }) => {
    return (
        <div {...props} className={clsx(styles["sidebar-button"], item.isActive && styles["active"], props.className)} >
            <div className={styles["sidebar-button-right"]}>{item.leftIcon} <p>{item.label}</p></div> {item.rightIcon ?? <ArrowRightIcon />}
        </div>
    );
};

export default SideBarButton;