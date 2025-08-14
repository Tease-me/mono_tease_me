import React, { ReactNode } from 'react';
import styles from "./AccountStatusBadge.module.css"
import { AccountStatus } from '@/mj-dashboard/data/models/enums';
import SvgPack from '@/utils/SvgPack';

interface AccountStatusBadgeProps {
    accountStatus: AccountStatus;
}

const AccountStatusBadge: React.FC<AccountStatusBadgeProps> = ({ accountStatus }) => {
    const accountStatusIcons: Record<AccountStatus, ReactNode> = {
        "0": <SvgPack.DangerCircleSmall />,
        "1": <SvgPack.DangerCircleSmall />,
        "2": <SvgPack.DangerCircleSmall />,
        "3": <SvgPack.DangerCircleSmall />,
        "4": <SvgPack.DangerCircleSmall />,
    }
    return (
        <div className={styles["account-status-badge"]}>
            {accountStatusIcons[accountStatus]}
        </div>
    );
};

export default AccountStatusBadge;