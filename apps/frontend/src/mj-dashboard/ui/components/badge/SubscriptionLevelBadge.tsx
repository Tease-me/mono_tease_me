import { SubscriptionLevel } from '@/mj-dashboard/data/models/enums';
import SvgPack from '@/utils/SvgPack';
import React, { ReactNode } from 'react';
import Badge, { BadgeType } from './Badge';

interface SubscriptionLevelBadgeProps {
    subscriptionLevel: SubscriptionLevel
}

const SubscriptionLevelBadge: React.FC<SubscriptionLevelBadgeProps> = ({ subscriptionLevel }) => {
    const subscriptionLevelContent: Record<SubscriptionLevel, { icon: ReactNode, text: string, badgeType: BadgeType }> = {
        0: { icon: <SvgPack.Star />, text: "Basic", badgeType: "primary" },
        1: { icon: <SvgPack.Triseption />, text: "Premium", badgeType: "white" },
        2: { icon: <SvgPack.Crown />, text: "Ultimate", badgeType: "warning" },
    }
    return (
        <Badge type={subscriptionLevelContent[subscriptionLevel].badgeType}>{subscriptionLevelContent[subscriptionLevel].icon} {subscriptionLevelContent[subscriptionLevel].text}</Badge>
    );
};

export default SubscriptionLevelBadge;