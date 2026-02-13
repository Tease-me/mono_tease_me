import React from "react";
import { Link, useLocation } from "react-router-dom";
import styles from "./AdminNav.module.css";

const links = [
  { to: "/admin/prompts", label: "Prompts" },
  { to: "/admin/influencer", label: "Influencers" },
  {
    to: "/admin/relationship",
    label: "Relationship Dashboard",
    external: false,
  },
  { to: "/admin/pre-influencers", label: "Pre-Influencers" },
  { to: "/admin/analytics", label: "Analytics" },
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
