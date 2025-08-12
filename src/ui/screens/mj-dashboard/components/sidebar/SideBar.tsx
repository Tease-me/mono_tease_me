import React, { ReactNode } from 'react';
import styles from "./SideBar.module.css"
import TeaseMeLogo from '@/ui/components/logos/TeaseMeLogo';
import SideBarButton from './components/SideBarButton';
import clsx from 'clsx';
import SvgPack from '@/utils/SvgPack';

export interface SideBarItem {
    leftIcon: ReactNode;
    title?: string;
    rightIcon?: ReactNode;
    isActive?: boolean;
    showRightIcon?: boolean;
}

export interface SectionTitle {
    title: string;
}

export type SideBarEntry = SideBarItem | SectionTitle;

const isSideBarItem = (entry: SideBarEntry): entry is SideBarItem =>
    'leftIcon' in entry;

interface SideBarProps {
    sideBarItems: SideBarEntry[]
}

const SideBar: React.FC<SideBarProps> = ({ sideBarItems }) => {


    return (
        <div className={styles["container"]}>
            <div className={styles["logo-container"]}>
                <TeaseMeLogo variant='full' size='large' />
            </div>
            <div className={styles["menu-container"]}>
                <div className={styles["top-menu"]}>
                    {sideBarItems.map((entry, idx) => (
                        isSideBarItem(entry) ? (
                            <SideBarButton key={`item-${idx}`} item={entry} />
                        ) : (
                            <div key={`section-${idx}`} className={styles['section-title']}>
                                {entry.title}
                            </div>
                        )
                    ))}
                </div>
                <div className={styles["bottom-menu"]}>
                    <div className={clsx(styles["logout-button"])}>
                        <SvgPack.Logout /> <p>Logout</p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SideBar;