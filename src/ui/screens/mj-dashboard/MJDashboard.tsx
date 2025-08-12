import React, { ReactNode } from 'react';
import TwoPaneLayout from './components/TwoPaneLayout';
import Content from './components/content/Content';
import SvgPack from '@/utils/SvgPack';
import SideBar from './components/sidebar/SideBar';

export interface SideBarItem {
    leftIcon: ReactNode;
    title?: string;
    rightIcon?: ReactNode;
    isActive?: boolean;
}

export interface SectionTitle {
    title: string;
}

export type SideBarEntry = SideBarItem | SectionTitle;
interface MJDashboardProps {
}

const MJDashboard: React.FC<MJDashboardProps> = ({ }) => {
    const sideBarItems: SideBarEntry[] = [
        {
            leftIcon: <SvgPack.Dashboard />,
            title: "Dashboard",
            isActive: true
        },
        {
            title: "Manage"
        },
        {
            leftIcon: <SvgPack.Users />,
            title: "Users",
        },
        {
            leftIcon: <SvgPack.Profile />,
            title: "Influencers",
        },
        {
            leftIcon: <SvgPack.Ai />,
            title: "Ai",
        },
        {
            leftIcon: <SvgPack.Chat />,
            title: "Conversation Pool",
        },
        {
            title: "Support"
        },
        {
            leftIcon: <SvgPack.Danger />,
            title: "User Issues",
        },
        {
            leftIcon: <SvgPack.Bill />,
            title: "Billing",
        },
    ]
    return (
        <TwoPaneLayout sidebar={<SideBar sideBarItems={sideBarItems} />} children={<Content />} />
    );
};

export default MJDashboard;