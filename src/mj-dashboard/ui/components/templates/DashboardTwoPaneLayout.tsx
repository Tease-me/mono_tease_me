import React from 'react';
import styles from './DashboardTwoPaneLayout.module.css';

interface DashboardTwoPaneLayoutProps {
    sidebar: React.ReactNode;
    showSidebar?: boolean;
    showContent?: boolean;
    children: React.ReactNode;
}

const DashboardTwoPaneLayout: React.FC<DashboardTwoPaneLayoutProps> = ({ showSidebar = true, showContent = true, sidebar, children }) => {
    return (
        <div className={styles.container}>
            {showSidebar && <div className={styles.sidebar}>
                {sidebar}
            </div>}
            {showContent && <div className={styles.content}>
                {children}
            </div>}
        </div>
    );
};

export default DashboardTwoPaneLayout;
