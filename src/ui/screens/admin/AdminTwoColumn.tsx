import React, { CSSProperties, ReactNode } from "react";
import styles from "./AdminTwoColumn.module.css";

type AdminTwoColumnProps = {
    sidebar: ReactNode;
    children: ReactNode;
    sidebarWidth?: number;
    gap?: string;
    sidebarStyled?: boolean;
    mainStyled?: boolean;
};

const AdminTwoColumn: React.FC<AdminTwoColumnProps> = ({
    sidebar,
    children,
    sidebarWidth = 300,
    gap = "var(--space-px-16)",
    sidebarStyled = true,
    mainStyled = true,
}) => {
    return (
        <div
            className={styles["layout"]}
            style={{ "--sidebar-width": `${sidebarWidth}px`, "--col-gap": gap } as CSSProperties}
        >
            <div className={`${styles["sidebar"]} ${sidebarStyled ? styles["sidebar--card"] : ""}`}>
                {sidebar}
            </div>
            <div className={`${styles["main"]} ${mainStyled ? styles["main--card"] : ""}`}>
                {children}
            </div>
        </div>
    );
};

export default AdminTwoColumn;
