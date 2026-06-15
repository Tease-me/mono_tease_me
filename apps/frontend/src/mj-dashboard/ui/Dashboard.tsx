import React, { lazy, ReactNode, Suspense, useEffect, useState } from 'react';
import SvgPack from '@/utils/SvgPack';
import SideBar from './components/sidebar/SideBar';
import DetailPane from './components/detail-pane/DetailPane';
import { storage } from '@/utils/storage';
import { LocalStorageKeys } from '@/constants/localStorageKeys';

const DashboardContent = lazy(() => import('./components/detail-pane/content/dashboard/DashboardContent'));
const UsersContent = lazy(() => import('./components/detail-pane/content/users/UsersContent'));
const DashboardTwoPaneLayout = lazy(() => import('./components/templates/DashboardTwoPaneLayout'));
const InfluencerContent = lazy(() => import('./components/detail-pane/content/influencers/InfluencerContent'));
const AiContent = lazy(() => import('./components/detail-pane/content/ai/AiContent'));
const ConversationPoolContent = lazy(() => import('./components/detail-pane/content/conversation-pool/ConversationPoolContent'));
const BillingContent = lazy(() => import('./components/detail-pane/content/billing/BillingContent'));
const GiftActivityContent = lazy(() => import('./components/detail-pane/content/gift-activity/GiftActivityContent'));
const IssueReportContent = lazy(() => import('./components/detail-pane/content/issue-reports/IssueReportContent'));
const BlockingLoader = lazy(() => import('@/ui/components/loading/BlockingLoader'));

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
            leftIcon: <SvgPack.Star />,
            label: "Gift Activity",
            title: "Gift Activity",
            content: <GiftActivityContent />
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

    useEffect(() => {
        const storedIndex = storage.getNumber(LocalStorageKeys.ActiveSidebarItem)
        setSideBarItems(prev => prev.map((entry, i) => {
            if (isSideBarItem(entry)) {
                return { ...entry, isActive: i === storedIndex };
            }
            return entry;
        }));
    }, [])

    const handleSideBarClick = (index: number) => {
        setSideBarItems(prev => prev.map((entry, i) => {
            if (isSideBarItem(entry)) {
                if (i == index)
                    storage.setNumber(LocalStorageKeys.ActiveSidebarItem, index ?? 0)
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
            <Suspense fallback={<BlockingLoader />}>
                <DetailPane title={getPageTitle()} scollable={getPageTitle() !== "Issue Reports"}>
                    {getPageContent()}
                </DetailPane>
            </Suspense>
        </DashboardTwoPaneLayout>
    );
};

export default MJDashboard;
