import React, { ReactNode } from 'react';
import styles from "./TabsLayout.module.css"
import clsx from 'clsx';

export interface TabItem {
    id: number,
    name: string;
    content: ReactNode;
}
interface TabsLayoutProps {
    tabs: TabItem[];
    activeTab: TabItem;
    setActiveTab: (tabItem: TabItem) => void;
}

const TabsLayout: React.FC<TabsLayoutProps> = ({ tabs, activeTab, setActiveTab }) => {

    const handleTabChange = (tab: TabItem) => {
        setActiveTab(tab)
    }

    return (
        <nav className={styles["tabs"]}>
            {tabs && tabs.map(tab => {
                return <span
                    key={tab.id}
                    className={clsx(styles["tab"], activeTab.id === tab.id && styles["active"])}
                    onClick={() => handleTabChange(tab)}>
                    {tab.name}
                </span>
            })}
        </nav>
    );
};

export default TabsLayout;