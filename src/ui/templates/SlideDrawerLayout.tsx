import React, { memo, useEffect, Suspense } from 'react';
import styles from './SlideDrawerLayout.module.css';
import clsx from "clsx"
import SvgPack from '@/utils/SvgPack';
import TeaseMeLogo from '../components/logos/TeaseMeLogo';
import { constants } from '@/utils/constants';

interface SlideDrawerLayoutProps {
  sidebar: React.ReactNode;
  showSidebar: boolean;
  onToggle: () => void;
  onBack: () => void;
  title: string;
  showBack: boolean;
  children: React.ReactNode;
  background?: string;
}

const SlideDrawerLayout: React.FC<SlideDrawerLayoutProps> = ({
  sidebar,
  showSidebar,
  onToggle,
  onBack,
  title,
  showBack = true,
  children,
  background
}) => {

  // Lock body scroll on mobile when sidebar is open
  useEffect(() => {
    if (!showSidebar) return;
    const mobileAndTabletMaxWidth = constants.DESKTOP_BREAKPOINT - 1;
    const mq = window.matchMedia(`(max-width: ${mobileAndTabletMaxWidth}px)`);
    if (!mq.matches) return;
    const scrollY = window.scrollY;
    document.body.style.position = 'fixed';
    document.body.style.top = `-${scrollY}px`;
    document.body.style.width = '100%';
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.position = '';
      document.body.style.top = '';
      document.body.style.width = '';
      document.body.style.overflow = '';
      window.scrollTo(0, scrollY);
    };
  }, [showSidebar]);

  return (
    <div className={styles.container}>
      {showSidebar && (
        <div
          className={styles.overlay}
          onClick={onToggle}
        />
      )}
      <div
        className={clsx(styles.sidebar, showSidebar ? styles.open : styles.closed)}
        style={background ? { background } : undefined}
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
              <Suspense fallback={null}><SvgPack.ArrowLeft /></Suspense>
            </button>
            <TeaseMeLogo size="small" variant="icon-only-dark" className={styles.logo} />
            <div className={styles.title}>{title}</div>
          </div>
          <div className={styles.headerRight}>
            <div
              onClick={onToggle}
              className={clsx(!showSidebar && styles.menuButton)}
            >
              <div className={styles.menuButtonIcon}>
                <Suspense fallback={null}>
                  {showSidebar ? <SvgPack.Cross /> : <SvgPack.Menu />}
                </Suspense>
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
