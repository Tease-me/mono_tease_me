import React from 'react';
import styles from './SlideDrawerLayout.module.css';
import clsx from "clsx"
import IconButton from '../components/inputs/buttons/IconButton';
import SvgPack from '@/utils/SvgPack';

interface SlideDrawerLayoutProps {
  sidebar: React.ReactNode;
  showSidebar: boolean;
  onToggle: () => void;
  showContent?: boolean;
  children: React.ReactNode;
}

const SlideDrawerLayout: React.FC<SlideDrawerLayoutProps> = ({
  sidebar,
  showSidebar,
  onToggle,
  showContent = true,
  children,
}) => (
  <div className={styles.container}>
    <div className={clsx(styles.sidebar, showSidebar ? styles.open : styles.closed)}>
      <IconButton
        onClick={onToggle}
        className={styles.menuButton}
        type="square"
        color="black"
        leftIcon={ showSidebar? < SvgPack.Cross/> : <SvgPack.Menu />}
      />
      {showSidebar && <div className={styles.sidebarContent}>{sidebar}</div>}
    </div>

    {showContent && <div className={styles.content}>{children}</div>}
  </div>
);



export default SlideDrawerLayout;
