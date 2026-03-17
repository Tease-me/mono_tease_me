import React, { Suspense } from "react";
import { Paths } from "@/routes/path";
import { Link, useLocation, useNavigate } from "react-router-dom";
import SvgPack from "@/utils/SvgPack";
import logo from "@/assets/logos/3D-IconTeaseMe-Dark.svg";
import styles from "./AdminNav.module.css";

type NavItem = { to: string; label: string; icon: React.ReactNode };

const NAV_ITEMS: NavItem[] = [
    { to: Paths.admin.analytics, label: "Analytics", icon: <SvgPack.Dashboard /> },
    { to: Paths.admin.relationship, label: "Relationship", icon: <SvgPack.Trust /> },
    { to: Paths.admin.characters, label: "Characters", icon: <SvgPack.StarHollow /> },
    { to: Paths.admin.influencerCharacter, label: "Influencer Character", icon: <SvgPack.Users /> },
    { to: Paths.admin.influencer, label: "Influencers", icon: <SvgPack.Users /> },
    { to: Paths.admin.preInfluencers, label: "Pre-Influencers", icon: <SvgPack.StarHollow /> },
    { to: Paths.admin.knowledge, label: "Knowledge", icon: <SvgPack.InfoCircle /> },
    { to: Paths.admin.prompts, label: "Prompts", icon: <SvgPack.Ai /> },
    { to: Paths.admin.chatHistory, label: "Chat History", icon: <SvgPack.ChatRound /> },
    { to: Paths.admin.logs, label: "Logs", icon: <SvgPack.Bill /> },
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

                {/* Nav items */}
                <div className={styles["nav-body"]}>
                    <div className={styles["nav-group"]}>
                        {NAV_ITEMS.map((item) => {
                            const isActive =
                                pathname === item.to || pathname.startsWith(`${item.to}/`);
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
