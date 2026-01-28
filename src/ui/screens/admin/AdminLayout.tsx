import React, { ReactNode } from "react";
import AdminNav from "./AdminNav";
import styles from "./AdminLayout.module.css";

type AdminLayoutProps = {
    title: string;
    subtitle?: string;
    headerRight?: ReactNode;
    children: ReactNode;
};

const AdminLayout: React.FC<AdminLayoutProps> = ({ title, subtitle, headerRight, children }) => {
    return (
        <div className={styles["container"]}>
            <AdminNav />
            <header className={styles["header"]}>
                <div>
                    <div className={styles["title"]}>{title}</div>
                    {subtitle ? <p className={styles["subtitle"]}>{subtitle}</p> : null}
                </div>
                {headerRight ? <div className={styles["header-right"]}>{headerRight}</div> : null}
            </header>
            <div className={styles["body"]}>{children}</div>
        </div>
    );
};

export default AdminLayout;
