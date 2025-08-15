import React, { ReactNode, useState } from 'react';
import SvgPack from '@/utils/SvgPack';
import SideBar from './components/sidebar/SideBar';
import DetailPane from './components/detail-pane/DetailPane';

import ConversationPoolContent from './components/detail-pane/content/ConversationPoolContent';
import IssueReportContent from './components/detail-pane/content/IssueReportContent';
import BillingContent from './components/detail-pane/content/BillingContent';
import DashboardContent from './components/detail-pane/content/dashboard/DashboardContent';
import UsersContent from './components/detail-pane/content/users/UsersContent';
import DashboardTwoPaneLayout from './components/templates/DashboardTwoPaneLayout';
import InfluencerContent from './components/detail-pane/content/influencers/InfluencerContent';
import AiContent from './components/detail-pane/content/ai/AiContent';

export interface SideBarItem {
    leftIcon: ReactNode;
    label: string;
    rightIcon?: ReactNode;
    title?: string;
    isActive?: boolean;
    content?: ReactNode;
}

export interface SectionTitle {
    label: string;
}

export type SideBarEntry = SideBarItem | SectionTitle;

const isSideBarItem = (entry: SideBarEntry): entry is SideBarItem =>
    'leftIcon' in entry;

interface MJDashboardProps { }

const MJDashboard: React.FC<MJDashboardProps> = ({ }) => {
    const [sideBarItems, setSideBarItems] = useState<SideBarEntry[]>([
        {
            leftIcon: <SvgPack.Dashboard />,
            label: "Dashboard",
            content: <DashboardContent />,
            isActive: true
        },
        {
            label: "Manage"
        },
        {
            leftIcon: <SvgPack.Users />,
            title: "User Management",
            label: "Users",
            content: <UsersContent />,
        },
        {
            leftIcon: <SvgPack.Profile />,
            label: "Influencers",
            title: "Influencer Management",
            content: <InfluencerContent />
        },
        {
            leftIcon: <SvgPack.Ai />,
            label: "Ai",
            title: "Ai Management",
            content: <AiContent />
        },
        {
            leftIcon: <SvgPack.Chat />,
            label: "Conversation Pool",
            content: <ConversationPoolContent />
        },
        {
            label: "Support"
        },
        {
            leftIcon: <SvgPack.Danger />,
            label: "User Issues",
            title: "Issue Reports",
            content: <IssueReportContent />
        },
        {
            leftIcon: <SvgPack.Bill />,
            label: "Billing",
            title: "Billing Payment",
            content: <BillingContent />
        },
    ]);

    const handleSideBarClick = (index: number) => {
        setSideBarItems(prev => prev.map((entry, i) => {
            if ('leftIcon' in entry) {
                return { ...entry, isActive: i === index };
            }
            return entry;
        }));
    };

    const getPageTitle = (): string | undefined => {
        const sideBarItem: SideBarItem = sideBarItems.find((item) => {
            if (isSideBarItem(item)) {
                return item.isActive
            }
        }) as SideBarItem;

        if (sideBarItem)
            return sideBarItem?.title ? sideBarItem.title : sideBarItem.label
    }

    const getPageContent = (): ReactNode | undefined => {
        const sideBarItem: SideBarItem = sideBarItems.find((item) => {
            if (isSideBarItem(item)) {
                return item.isActive
            }
        }) as SideBarItem;

        return sideBarItem?.content
    }

    return (
        <DashboardTwoPaneLayout sidebar={<SideBar sideBarItems={sideBarItems} onItemClick={handleSideBarClick} />}>
            <DetailPane title={getPageTitle()}>
                {getPageContent()}
            </DetailPane>
        </DashboardTwoPaneLayout>
    );
};

export default MJDashboard;