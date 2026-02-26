import React, { Suspense } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import SvgPack from "@/utils/SvgPack";
import logo from "@/assets/logos/3D-IconTeaseMe-Dark.svg";
import styles from "./AdminNav.module.css";

type NavItem = { to: string; label: string; icon: React.ReactNode };
type NavGroup = { label?: string; items: NavItem[] };

const NAV_GROUPS: NavGroup[] = [
    {
        items: [
            { to: "/admin/relationship", label: "Dashboard", icon: <SvgPack.Dashboard /> },
        ],
    },
    {
        label: "Manage",
        items: [
            { to: "/admin/influencer",     label: "Influencers",    icon: <SvgPack.Users /> },
            { to: "/admin/pre-influencers", label: "Pre-Influencers", icon: <SvgPack.Star /> },
            { to: "/admin/knowledge",       label: "Knowledge",      icon: <SvgPack.InfoCircle /> },
        ],
    },
    {
        label: "AI",
        items: [
            { to: "/admin/prompts", label: "Prompts", icon: <SvgPack.Message /> },
        ],
    },
    {
        label: "History",
        items: [
            { to: "/admin/chat-history", label: "Chat History", icon: <SvgPack.ChatRound /> },
        ],
    },
];

type AdminNavProps = {
    isOpen: boolean;
    onClose: () => void;
};

const AdminNav: React.FC<AdminNavProps> = ({ isOpen, onClose }) => {
    const { pathname } = useLocation();
    const navigate = useNavigate();

    return (
        <>
            {isOpen && <div className={styles["backdrop"]} onClick={onClose} />}

            <nav className={`${styles["sidebar"]} ${isOpen ? styles["sidebar--open"] : ""}`}>
                {/* Logo */}
                <div className={styles["sidebar-logo"]}>
                    <img src={logo} alt="TeaseMe" className={styles["logo-img"]} />
                    <span className={styles["logo-text"]}>TeaseMe</span>
                    <button className={styles["close-btn"]} onClick={onClose} aria-label="Close menu">
                        <Suspense fallback={null}><SvgPack.Cross /></Suspense>
                    </button>
                </div>

                {/* Nav groups */}
                <div className={styles["nav-body"]}>
                    {NAV_GROUPS.map((group, gi) => (
                        <div key={gi} className={styles["nav-group"]}>
                            {group.label && (
                                <div className={styles["group-label"]}>{group.label}</div>
                            )}
                            {group.items.map((item) => {
                                const isActive = pathname.startsWith(item.to);
                                return (
                                    <Link
                                        key={item.to + item.label}
                                        to={item.to}
                                        className={`${styles["nav-item"]} ${isActive ? styles["nav-item--active"] : ""}`}
                                        onClick={onClose}
                                    >
                                        <span className={styles["nav-icon"]}>
                                            <Suspense fallback={<span className={styles["icon-fallback"]} />}>
                                                {item.icon}
                                            </Suspense>
                                        </span>
                                        <span className={styles["nav-label"]}>{item.label}</span>
                                        {!isActive && <span className={styles["nav-chevron"]} />}
                                    </Link>
                                );
                            })}
                        </div>
                    ))}
                </div>

                {/* Logout */}
                <button className={styles["logout-btn"]} onClick={() => navigate("/")}>
                    <span className={styles["nav-icon"]}>
                        <Suspense fallback={null}><SvgPack.Logout /></Suspense>
                    </span>
                    <span>Logout</span>
                </button>
            </nav>
        </>
    );
};

export default AdminNav;
