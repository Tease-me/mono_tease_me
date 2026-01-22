import React, { memo } from 'react';
import styles from './SlideDrawerLayout.module.css';
import clsx from "clsx"
import SvgPack from '@/utils/SvgPack';
import TeaseMeLogo from '../components/logos/TeaseMeLogo';

interface SlideDrawerLayoutProps {
  sidebar: React.ReactNode;
  showSidebar: boolean;
  onToggle: () => void;
  onBack: () => void;
  title: string;
  showBack: boolean;
  children: React.ReactNode;
}

const SlideDrawerLayout: React.FC<SlideDrawerLayoutProps> = ({
  sidebar,
  showSidebar,
  onToggle,
  onBack,
  title,
  showBack = true,
  children,
}) => {


  return (
    <div className={styles.container}>
      <div
        className={clsx(styles.sidebar, showSidebar ? styles.open : styles.closed)}
        data-open={showSidebar ? "true" : "false"}
        data-show-back={showBack ? "true" : "false"}
      >
        <div className={styles.sidebarHeader}>
          <div className={styles.headerLeft}>
            <button
              type="button"
              className={styles.backIconButton}
              onClick={onBack ?? onToggle}
            >
              <SvgPack.ArrowLeft />
            </button>
            <TeaseMeLogo size="small" variant="full" className={styles.logo} />
            <div className={styles.title}>{title}</div>
          </div>
          <div className={styles.headerRight}>
            <div
              onClick={onToggle}
              className={clsx(!showSidebar && styles.menuButton)}
            >
              <div className={styles.menuButtonIcon}>
                {showSidebar ? <SvgPack.Cross /> : <SvgPack.Menu />}
              </div>
            </div>
          </div>
        </div>
        <div className={styles.headerDivider} />
        <div className={styles.sidebarContent}>{sidebar}</div>
      </div>
      {<div className={styles.content}>{children}</div>}
    </div>
  )
};

export default memo(SlideDrawerLayout);
