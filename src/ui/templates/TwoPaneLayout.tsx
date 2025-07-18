import React from 'react';
import styles from './TwoPaneLayout.module.css';

interface TwoPaneLayoutProps {
    sidebar: React.ReactNode;
    showSidebar?: boolean;
    showContent?: boolean;
    children: React.ReactNode;
}

const TwoPaneLayout: React.FC<TwoPaneLayoutProps> = ({ showSidebar, showContent, sidebar, children }) => {
    return (
        <div className={styles.container}>
            {showSidebar && <aside className={styles.sidebar}>
                {sidebar}
            </aside>}
            {showContent && <main className={styles.content}>
                {children}
            </main>}
        </div>
    );
};

export default TwoPaneLayout;
