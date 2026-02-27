import React from "react";
import { Paths } from "@/routes/path";
import { Link, useLocation } from "react-router-dom";
import styles from "./AdminNav.module.css";

const links = [
  { to: Paths.admin.prompts, label: "Prompts" },
  { to: Paths.admin.influencer, label: "Influencers" },
  {
    to: Paths.admin.relationship,
    label: "Relationship Dashboard",
    external: false,
  },
  { to: Paths.admin.preInfluencers, label: "Pre-Influencers" },
  { to: Paths.admin.knowledge, label: "Knowledge" },
  { to: Paths.admin.chatHistory, label: "Chat History" },
  { to: Paths.admin.logs, label: "Logs" },
];

const AdminNav: React.FC = () => {
  const { pathname } = useLocation();

  return (
    <nav className={styles["nav"]}>
      <div className={styles["brand"]}>Admin</div>
      <div className={styles["links"]}>
        {links.map((link) => {
          const isActive = !link.external && pathname.startsWith(link.to);
          const className = `${styles["link"]} ${isActive ? styles["link--active"] : ""
            }`;
          return link.external ? (
            <a
              key={link.to}
              href={link.to}
              className={className}
              target="_blank"
              rel="noreferrer"
            >
              {link.label}
            </a>
          ) : (
            <Link key={link.to} to={link.to} className={className}>
              {link.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
};

export default AdminNav;
