import React from 'react'
import { useEffect } from 'react'
import styles from './UserNav.module.css'
import TeaseMeLogo from '../logos/TeaseMeLogo'
import SvgPack from '@/utils/SvgPack'
import IconButton from '../inputs/buttons/IconButton'
import { useIsDesktopOnly } from '@/hooks/layout/useIsDesktop'
import { useTheme } from '@/theme/ThemeProvider'
import AdultModeToggle from "@/ui/components/adult-mode-toggle/AdultModeToggle";
import clsx from 'clsx'

interface UserNavProps extends React.HTMLAttributes<HTMLDivElement> {
  onCallClick?: () => void;
  onMenuClick?: () => void;
  adultMode?: boolean;
  callMode?: boolean;
  onAdultModeChange?: (checked: boolean) => void;
  minutesRemaining?: number;
  title?: string;
}


const UserNav: React.FC<UserNavProps> = ({ onCallClick, onMenuClick, adultMode, callMode, onAdultModeChange, minutesRemaining, title }) => {
  const isMobile = useIsDesktopOnly() === false;
  const { theme, setTheme } = useTheme();
  useEffect(() => {
    if (typeof adultMode === "boolean") {
      setTheme(adultMode ? 'adult' : 'default');
    }
  }, [adultMode, setTheme]);

  return (
    <div className={styles.bar}>
      {title && <div className={styles.logoLeft}><TeaseMeLogo variant="full" /></div>}
      <div className={styles.maxWidthSpacer}>
        <div className={styles.leftSlot}>
          {isMobile && (
            <div onClick={onMenuClick} className={styles.menuButton}>
              <SvgPack.Menu className={styles.menuButtonIcon} />
            </div>
          )}
          {!isMobile && onAdultModeChange && (
            <AdultModeToggle
              checked={theme === 'adult'}
              onChange={(checked) => { onAdultModeChange(checked); }}
              minutesLeft={minutesRemaining}
              showMinutes={false}
            />
          )}
        </div>

        {isMobile && onAdultModeChange ? (
          <AdultModeToggle
            checked={theme === 'adult'}
            onChange={(checked) => { onAdultModeChange(checked); }}
            minutesLeft={minutesRemaining}
            showMinutes={false}
          />
        ) : (
          title
            ? <span className={styles.navTitle}>{title}</span>
            : <div className={styles.logoArea}><TeaseMeLogo variant="full" /></div>
        )}

        <div className={styles["right-buttons"]}>
          {onCallClick && <IconButton leftIcon={callMode ? <SvgPack.Chat className={clsx(styles.callChatIcon)} /> : <SvgPack.Call className={clsx(styles.callCallIcon)} />} onClick={onCallClick} className={clsx(styles.callButton, adultMode && styles.hidden)} color='black' text={isMobile ? "" : "Mode"} />}
        </div>
      </div>
    </div>
  )

}

export default UserNav;
