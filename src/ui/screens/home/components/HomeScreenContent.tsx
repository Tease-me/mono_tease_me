
import React, { useEffect, useRef, useState } from 'react';
import styles from "./HomeScreenContent.module.css"
import clsx from 'clsx';
import { useNavigate } from 'react-router-dom';

import avatar from "@/assets/image/avatar.png";
import TeaseMeLogo from '@/ui/components/logos/TeaseMeLogo';
import { InfluencerDataModel } from '@/data/models/InfluencerDataModel';

export const contacts: InfluencerDataModel[] = [
    {
        id: "loli",
        name: "Lola Fairfax",
        username: "loli",
        likes: "27.3M",
        img: avatar,
        featured: true,
    },
    {
        id: "bella",
        name: "Bella Thorne",
        username: "bella",
        likes: "24.5M",
        img: avatar,
    },
    {
        id: "anna",
        name: "Annabelle Norton",
        username: "anna",
        likes: "10.1M",
        img: avatar,
    },
];

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

    const [menuOpen, setMenuOpen] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);
    const buttonRef = useRef<HTMLButtonElement>(null);

    const navigate = useNavigate();

    useEffect(() => {
        const closeMenu = (e: MouseEvent) => {
            if (
                menuRef.current &&
                !menuRef.current.contains(e.target as Node) &&
                buttonRef.current &&
                !buttonRef.current.contains(e.target as Node)
            ) {
                setMenuOpen(false);
            }
        };

        document.addEventListener("mousedown", closeMenu);
        return () => document.removeEventListener("mousedown", closeMenu);
    }, []);

    const handleOnChatClick = (id: string) => {
        if (onItemClick) {
            onItemClick(id);
        } else {
            navigate(`/chat/${id}`);
        }
    };
    return (
        <div className={styles["home-screen-content"]}>
            <header className={styles["home-header"]}>
                <TeaseMeLogo size="small" />
                <button
                    className={styles["menu-button"]}
                    onClick={() => setMenuOpen((prev) => !prev)}
                    ref={buttonRef}
                >
                    ⋯
                </button>

                {menuOpen && (
                    <div className={styles["dropdown-menu"]} ref={menuRef}>
                        <div className={styles["dropdown-item"]}>
                            <span>👤</span> My Profile
                        </div>
                        <div className={styles["divider"]}></div>
                        <div className={styles["dropdown-item"]}>
                            <span>🧩</span> Subscriptions
                        </div>
                        <div className={styles["divider"]}></div>
                        <div className={styles["dropdown-item"]}>
                            <span>⚠️</span> Support
                        </div>
                    </div>
                )}
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
                                    <p>{contact.username} | {contact.likes} likes</p>
                                </div>
                                <button className={clsx(contact.featured ? styles["chat-btn"] : styles["trial-btn"])}>
                                    ♾️ Chat
                                </button>
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
                                    <p>
                                        {contact.username} | {contact.likes} likes
                                    </p>
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