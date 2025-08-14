import React from 'react';
import styles from "./DashboardUserListItem.module.css"
import { DashboardUserModel } from '@/mj-dashboard/data/models/DashboardUserModel';
import CheckBox from '@/ui/components/inputs/check-boxes/CheckBox';
import SvgPack from '@/utils/SvgPack';
import clsx from 'clsx';
import AccountStatusBadge from '@/mj-dashboard/ui/components/badge/AcountStatusBadge';
import SubscriptionLevelBadge from '@/mj-dashboard/ui/components/badge/SubscriptionLevelBadge';

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
                <AccountStatusBadge accountStatus={user.accountStatus} />
            </div>
            <div className={clsx(styles["col"], styles["subsciption-level"])}>
                <SubscriptionLevelBadge subscriptionLevel={user.subscriptionLevel} />
            </div>
            <div className={clsx(styles["col"], styles["action"])}>
                <SvgPack.MoreCircle />
            </div>
        </div>
    );
};

export default DashboardUserListItem;