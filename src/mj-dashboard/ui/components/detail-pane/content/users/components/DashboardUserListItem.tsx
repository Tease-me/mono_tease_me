import React, { ReactNode } from 'react';
import styles from "./DashboardUserListItem.module.css"
import { DashboardUserModel } from '@/mj-dashboard/data/models/DashboardUserModel';
import CheckBox from '@/ui/components/inputs/check-boxes/CheckBox';
import SvgPack from '@/utils/SvgPack';
import clsx from 'clsx';
import Badge, { BadgeType } from '@/mj-dashboard/ui/components/badge/Badge';
import { AccountStatus, SubscriptionLevel } from '@/mj-dashboard/data/models/enums';

interface DashboardUserListItemProps {
    user: DashboardUserModel
}

const DashboardUserListItem: React.FC<DashboardUserListItemProps> = ({ user }) => {
    const accountSettingsContent: Record<AccountStatus, { icon: ReactNode, text: string, badgeType: BadgeType }> = {
        0: { icon: <SvgPack.TickSquare />, text: "Active", badgeType: "success" },
        1: { icon: <SvgPack.DangerTriangleSmall />, text: "BlockList", badgeType: "danger" },
        2: { icon: <SvgPack.StarHollow />, text: "Frozen", badgeType: "neutral" },
        3: { icon: <SvgPack.DangerCircleSmall />, text: "Suspended", badgeType: 'warning' },
        4: { icon: <SvgPack.CloseSquare />, text: "Inactive", badgeType: "inactive" },
    }

    const subscriptionLevelContent: Record<SubscriptionLevel, { icon: ReactNode, text: string, badgeType: BadgeType }> = {
        0: { icon: <SvgPack.TickSquare />, text: "Basic", badgeType: "primary" },
        1: { icon: <SvgPack.DangerTriangleSmall />, text: "Premium", badgeType: "inactive" },
        2: { icon: <SvgPack.StarHollow />, text: "Ultimate", badgeType: "warning" },
    }

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
                <Badge type={accountSettingsContent[user.accountStatus].badgeType}>{accountSettingsContent[user.accountStatus].icon} {accountSettingsContent[user.accountStatus].text}</Badge>
            </div>
            <div className={clsx(styles["col"], styles["subsciption-level"])}>
                <Badge type={subscriptionLevelContent[user.subscriptionLevel].badgeType}>{subscriptionLevelContent[user.subscriptionLevel].icon} {subscriptionLevelContent[user.subscriptionLevel].text}</Badge>
            </div>
            <div className={clsx(styles["col"], styles["action"])}>
                <SvgPack.MoreCircle />
            </div>
        </div>
    );
};

export default DashboardUserListItem;