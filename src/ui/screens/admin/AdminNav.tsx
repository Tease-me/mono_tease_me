import React from "react";
import { Link, useLocation } from "react-router-dom";
import styles from "./AdminNav.module.css";

const links = [
    { to: "/admin/prompts", label: "Prompts" },
    { to: "/admin/influencer", label: "Influencers" },
];

const AdminNav: React.FC = () => {
    const { pathname } = useLocation();

    return (
        <nav className={styles["nav"]}>
            <div className={styles["brand"]}>Admin</div>
            <div className={styles["links"]}>
                {links.map((link) => {
                    const isActive = pathname.startsWith(link.to);
                    return (
                        <Link
                            key={link.to}
                            to={link.to}
                            className={`${styles["link"]} ${isActive ? styles["link--active"] : ""}`}
                        >
                            {link.label}
                        </Link>
                    );
                })}
            </div>
        </nav>
    );
};

export default AdminNav;
