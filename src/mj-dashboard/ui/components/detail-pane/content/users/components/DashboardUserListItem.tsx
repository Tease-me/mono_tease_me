import React from 'react';
import styles from "./DashboardUserListItem.module.css"
import { DashboardUserModel } from '@/mj-dashboard/data/models/DashboardUserModel';
import CheckBox from '@/ui/components/inputs/check-boxes/CheckBox';
import SvgPack from '@/utils/SvgPack';
import clsx from 'clsx';
import Badge from '@/mj-dashboard/ui/components/badge/Badge';

interface DashboardUserListItemProps {
    user: DashboardUserModel
}

const DashboardUserListItem: React.FC<DashboardUserListItemProps> = ({ user }) => {
    return (
        <div className={styles["dashboard-user-list-item"]}>
            <CheckBox />
            <div className={clsx(styles["col"], styles["id"])}>{user.id}</div>
            <div className={clsx(styles["col"], styles["user"])}>
                <img src={user.imgUrl} />
                {user.fullName}
            </div>
            <div className={clsx(styles["col"], styles["joined-date"])}>
                {user.joinedDate}
            </div>
            <div className={clsx(styles["col"], styles["account-status"])}>
                <Badge type='danger'><SvgPack.DangerCircleSmall /> Suspended</Badge>
            </div>
            <div className={clsx(styles["col"], styles["subsciption-level"])}>
                <Badge type='primary'><SvgPack.Star /> Basic</Badge>
            </div>
            <div className={clsx(styles["col"], styles["action"])}>
                <SvgPack.MoreCircle />
            </div>
        </div>
    );
};

export default DashboardUserListItem;