import React, { useContext, useEffect, useRef, useState, useMemo } from 'react';
import styles from "./HomeScreenContent.module.css"
import clsx from 'clsx';
import { useNavigate } from 'react-router-dom';

import TeaseMeLogo from '@/ui/components/logos/TeaseMeLogo';
import { contacts } from '@/data/mock/contacts';
import ProfileIcon from "@/assets/svg/Profile.svg?react"
import TicketIcon from "@/assets/svg/Ticket.svg?react"
import DangerIcon from "@/assets/svg/Danger.svg?react"
import InboxIcon from "@/assets/svg/inbox.svg?react"
import LogoutIcon from "@/assets/svg/Logout.svg?react";

import { AuthContext } from '@/context/AuthContext';
import DropDownMenu, { DropDownMenuDataModel } from '@/ui/components/inputs/dropdown/DropDownMenu';
import TabsLayout, { TabItem } from '@/ui/components/tabs/TabsLayout';
import ContactTabContent from './tab-contents/ContactTabContent';
import { InfluencerDataModel } from '@/data/models/InfluencerDataModel';
import SiggestedTabContent from './tab-contents/SuggestedTabContent';

interface HomeScreenContentProps {
    id?: string;
    onItemClick?: (id: string) => void;
}

const HomeScreenContent: React.FC<HomeScreenContentProps> = ({ id, onItemClick }) => {
    const { logout } = useContext(AuthContext);
    const navigate = useNavigate();

    const handleOnChatClick = (influencer: InfluencerDataModel) => {
        if (onItemClick) {
            onItemClick(influencer.id);
        } else {
            navigate(`/chat/${influencer.id}`);
        }
    };

    const tabItems: TabItem[] = useMemo(() => [
        {
            id: 1,
            name: "Contacts",
            content: <ContactTabContent onChatClicked={handleOnChatClick} selectedContactId={id} />
        },
        {
            id: 2,
            name: "Suggested",
            content: <SiggestedTabContent />
        },
    ], [id]);
    const [activeTab, setActiveTab] = useState(tabItems[0]);
    useEffect(() => {
        if (activeTab.id === 1) {
            const updated = tabItems.find(t => t.id === 1);
            if (updated) {
                setActiveTab(updated);
            }
        }
    }, [id, tabItems, activeTab.id]);


    const testDataDropDown: DropDownMenuDataModel[] = [
        {
            id: 1,
            icon: <ProfileIcon />,
            text: "My Profile",
            onClick: () => {
                navigate("/profile");
            }
        },
        {
            id: 2,
            icon: <TicketIcon />,
            text: "Subscriptions"
        },
        {
            id: 3,
            icon: <DangerIcon />,
            text: "Support"
        },
        {
            id: 4,
            icon: <LogoutIcon />,
            text: "Logout",
            styles: {
                style: { color: "var(--color-alert)" },
                hoverStyle: { color: "var(--color-primary)" },
                iconStyle: { color: "var(--color-primary)" }
            },
            onClick: () => {
                logout();
            }
        },
    ]

    return (
        <div className={styles["home-screen-content"]}>
            <header className={styles["home-header"]}>
                <TeaseMeLogo size="small" />
                <DropDownMenu menu={testDataDropDown} className={styles["inbox-icon"]}><InboxIcon /></DropDownMenu>
            </header>

            <TabsLayout tabs={tabItems} setActiveTab={setActiveTab} activeTab={activeTab} />

            {activeTab && (
                activeTab.content
            )}
        </div>
    );
};

export default HomeScreenContent;