import React, { ReactNode } from 'react';
import { AccountStatus } from '@/mj-dashboard/data/models/enums';
import SvgPack from '@/utils/SvgPack';
import Badge, { BadgeType } from './Badge';

interface AccountStatusBadgeProps {
    accountStatus: AccountStatus;
}

const AccountStatusBadge: React.FC<AccountStatusBadgeProps> = ({ accountStatus }) => {
    const accountSettingsContent: Record<AccountStatus, { icon: ReactNode, text: string, badgeType: BadgeType }> = {
        0: { icon: <SvgPack.TickSquare />, text: "Active", badgeType: "success" },
        1: { icon: <SvgPack.DangerTriangleSmall />, text: "BlockList", badgeType: "danger" },
        2: { icon: <SvgPack.StarHollow />, text: "Frozen", badgeType: "neutral" },
        3: { icon: <SvgPack.DangerCircleSmall />, text: "Suspended", badgeType: 'warning' },
        4: { icon: <SvgPack.CloseSquare />, text: "Inactive", badgeType: "inactive" },
    }
    return (
        <Badge type={accountSettingsContent[accountStatus].badgeType}>{accountSettingsContent[accountStatus].icon} {accountSettingsContent[accountStatus].text}</Badge>
    );
};

export default AccountStatusBadge;