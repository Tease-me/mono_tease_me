import React from 'react';
import styles from './SlideDrawerLayout.module.css';
import clsx from "clsx"
import IconButton from '../components/inputs/buttons/IconButton';
import SvgPack from '@/utils/SvgPack';
import useIsDesktop from '@/utils/hooks/useIsDesktop';
import TeaseMeLogo from '../components/logos/TeaseMeLogo';

interface SlideDrawerLayoutProps {
  sidebar: React.ReactNode;
  showSidebar: boolean;
  onToggle: () => void;
  onBack: () => void;
  title: string;
  showBack: boolean;
  showContent?: boolean;
  children: React.ReactNode;
}

const SlideDrawerLayout: React.FC<SlideDrawerLayoutProps> = ({
  sidebar,
  showSidebar,
  onToggle,
  onBack,
  title,
  showBack = true,
  showContent = true,
  children,
}) => {

  
  return (
  <div className={styles.container}>
    <div className={clsx(styles.sidebar, showSidebar ? styles.open : styles.closed)}>
      <div className={styles.sidebarHeader}>
        <div className={styles.headerLeft}>
          {showSidebar && showBack && (
            <button
              type="button"
              className={styles.backIconButton}
              onClick={onBack ?? onToggle}
            >
              <SvgPack.ArrowLeft />
            </button>
          )}
            {showSidebar && !showBack && (
    <TeaseMeLogo size="small" variant="full" className={styles.logo} />
  )}

          {title && showSidebar && <div className={styles.title}>{title}</div>}
        </div>
        <IconButton
          onClick={onToggle}
          className={styles.menuButton}
          type="square"
          color="black"
          leftIcon={showSidebar ? <SvgPack.Cross /> : <SvgPack.Menu />}
        />
      </div>
      <div className={styles.headerDivider} />
      {showSidebar && <div className={styles.sidebarContent}>{sidebar}</div>}
    </div>

    {showContent && <div className={styles.content}>{children}</div>}
  </div>
)};



export default SlideDrawerLayout;
