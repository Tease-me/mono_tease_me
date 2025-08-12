import React from 'react';
import styles from './TwoPaneLayout.module.css';

interface TwoPaneLayoutProps {
    sidebar: React.ReactNode;
    showSidebar?: boolean;
    showContent?: boolean;
    children: React.ReactNode;
}

const TwoPaneLayout: React.FC<TwoPaneLayoutProps> = ({ showSidebar = true, showContent = true, sidebar, children }) => {
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

export default TwoPaneLayout;
