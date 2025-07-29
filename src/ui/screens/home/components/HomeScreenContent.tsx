import React, { useContext, useEffect, useRef, useState } from 'react';
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
import CircularIconButton from '@/ui/components/inputs/buttons/CircularIconButton';
import InfinityIcon from "@/assets/svg/Infinity.svg?react";

interface HomeScreenContentProps {
    id?: string;
    onItemClick?: (id: string) => void;
}

const HomeScreenContent: React.FC<HomeScreenContentProps> = ({ id, onItemClick }) => {
    const [activeTab, setActiveTab] = useState("contacts");
    const [search, setSearch] = useState("");
    const filteredContacts = contacts.filter((c) =>
        c.name.toLowerCase().includes(search.toLowerCase())
    );
    const { logout } = useContext(AuthContext);
    const navigate = useNavigate();

    const handleOnChatClick = (id: string) => {
        if (onItemClick) {
            onItemClick(id);
        } else {
            navigate(`/chat/${id}`);
        }
    };

    const testDataDropDown: DropDownMenuDataModel[] = [
        {
            id: 1,
            icon: <ProfileIcon />,
            text: "My Profile"
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

            <nav className={styles["tabs"]}>
                <span
                    className={clsx(styles["tab"], activeTab === "contacts" && styles["active"])}
                    onClick={() => setActiveTab("contacts")}
                >
                    Contacts
                </span>
                <span
                    className={clsx(styles["tab"], activeTab === "suggested" && styles["active"])}
                    onClick={() => setActiveTab("suggested")}>
                    Suggested
                </span>
            </nav>

            {activeTab === "contacts" && (
                <>
                    <input
                        className={styles["search-input"]}
                        placeholder="🔍 Search"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />

                    <div className={styles["vertical-scroll"]}>
                        {filteredContacts.map((contact) => (
                            <div
                                key={contact.id}
                                className={clsx(styles["contact-card"], contact.id === id && styles["highlight"])}
                                onClick={() => handleOnChatClick(contact.id)}>
                                <img src={contact.img} alt={contact.name} />
                                <div>
                                    <h4>{contact.name}</h4>
                                    <p>{contact.username}</p>
                                </div>
                                <CircularIconButton icon={<InfinityIcon />} text='Chat' size='xsmall' />
                            </div>
                        ))}
                    </div>
                </>
            )}

            {activeTab === "suggested" && (
                <>
                    <div className={clsx(styles["suggested-images"], styles["horizontal-scroll"])}>
                        {contacts.slice(0, 5).map((contact) => (
                            <img key={contact.id} src={contact.img} alt={contact.name} />
                        ))}
                    </div>

                    <div className={styles["vertical-scroll"]}>
                        {contacts.map((contact) => (
                            <div key={contact.id} className={styles["contact-card"]}>
                                <img src={contact.img} alt={contact.name} />
                                <div>
                                    <h4>{contact.name}</h4>
                                    <p>{contact.username}</p>
                                </div>
                                <button className={styles["trial-btn"]}>Trial</button>
                            </div>
                        ))}
                    </div>
                </>
            )}
        </div>
    );
};

export default HomeScreenContent;