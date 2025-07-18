import React from 'react';
import styles from './TwoPaneLayout.module.css';

interface TwoPaneLayoutProps {
    nav: React.ReactNode;
    children: React.ReactNode;
}

const TwoPaneLayout: React.FC<TwoPaneLayoutProps> = ({ nav, children }) => {
    return (
        <div className={styles.container}>
            <aside className={styles.sidebar}>
                {nav}
            </aside>
            <main className={styles.content}>
                {children}
            </main>
        </div>
    );
};

export default TwoPaneLayout;
