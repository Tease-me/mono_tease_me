import React, { ReactNode, useState } from 'react';
import TwoPaneLayout from './components/TwoPaneLayout';
import Content from './components/content/Content';
import SvgPack from '@/utils/SvgPack';
import SideBar from './components/sidebar/SideBar';

export interface SideBarItem {
    leftIcon: ReactNode;
    label: string;
    rightIcon?: ReactNode;
    title?: string;
    isActive?: boolean;
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
            isActive: true
        },
        {
            label: "Manage"
        },
        {
            leftIcon: <SvgPack.Users />,
            title: "User Management",
            label: "Users",
        },
        {
            leftIcon: <SvgPack.Profile />,
            label: "Influencers",
            title: "Influencer Management",
        },
        {
            leftIcon: <SvgPack.Ai />,
            label: "Ai",
            title: "Ai Management",
        },
        {
            leftIcon: <SvgPack.Chat />,
            label: "Conversation Pool",
        },
        {
            label: "Support"
        },
        {
            leftIcon: <SvgPack.Danger />,
            label: "User Issues",
            title: "Issue Reports",
        },
        {
            leftIcon: <SvgPack.Bill />,
            label: "Billing",
            title: "Billing Payment",
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

    return (
        <TwoPaneLayout sidebar={<SideBar sideBarItems={sideBarItems} onItemClick={handleSideBarClick} />} children={<Content title={getPageTitle()} />} />
    );
};

export default MJDashboard;