import React from 'react';
import styles from "./SideBar.module.css"
import TeaseMeLogo from '@/ui/components/logos/TeaseMeLogo';
import SideBarButton from './components/SideBarButton';
import clsx from 'clsx';
import SvgPack from '@/utils/SvgPack';
import { SideBarEntry, SideBarItem } from '../../Dashboard';
import AppVersionBadge from '@/ui/components/app-version/AppVersionBadge';

const isSideBarItem = (entry: SideBarEntry): entry is SideBarItem =>
    'leftIcon' in entry;

interface SideBarProps {
    sideBarItems: SideBarEntry[];
    onItemClick?: (index: number) => void;
}

const SideBar: React.FC<SideBarProps> = ({ sideBarItems, onItemClick }) => {
    return (
        <div className={styles["container"]}>
            <div className={styles["logo-container"]}>
                <TeaseMeLogo variant='full' size='large' />
            </div>
            <div className={styles["menu-container"]}>
                <div className={styles["top-menu"]}>
                    {sideBarItems.map((entry, idx) => (
                        isSideBarItem(entry) ? (
                            <SideBarButton key={`item-${idx}`} item={entry} onClick={() => onItemClick?.(idx)} />
                        ) : (
                            <div key={`section-${idx}`} className={styles['section-title']}>
                                {entry.label}
                            </div>
                        )
                    ))}
                </div>
                <div className={styles["bottom-menu"]}>
                    <div className={clsx(styles["logout-button"])}>
                        <SvgPack.Logout /> <p>Logout</p>
                    </div>
                    <div className={styles["version-container"]}>
                        <AppVersionBadge />
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SideBar;