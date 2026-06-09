import React, { ReactNode, Suspense, useState } from "react";
import AdminNav from "./AdminNav";
import SvgPack from "@/utils/SvgPack";
import styles from "./AdminLayout.module.css";

type AdminLayoutProps = {
    title: string;
    subtitle?: string;
    headerRight?: ReactNode;
    children: ReactNode;
};

const AdminLayout: React.FC<AdminLayoutProps> = ({ title, subtitle, headerRight, children }) => {
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);

    return (
        <div className={styles["container"]}>
            <AdminNav isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />

            <div className={styles["main"]}>
                <header className={styles["header"]}>
                    <div className={styles["header-left"]}>
                        <button
                            className={styles["hamburger"]}
                            onClick={() => setIsSidebarOpen(true)}
                            aria-label="Open menu"
                        >
                            <Suspense fallback={null}><SvgPack.Menu /></Suspense>
                        </button>
                        <div>
                            <div className={styles["title"]}>{title}</div>
                            {subtitle ? <p className={styles["subtitle"]}>{subtitle}</p> : null}
                        </div>
                    </div>
                    {headerRight ? <div className={styles["header-right"]}>{headerRight}</div> : null}
                </header>

                <div className={styles["body"]}>{children}</div>
            </div>
        </div>
    );
};

export default AdminLayout;
