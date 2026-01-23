import React from 'react'
import { useEffect } from 'react'
import styles from './UserNav.module.css'
import TeaseMeLogo from '../logos/TeaseMeLogo'
import SvgPack from '@/utils/SvgPack'
import IconButton from '../inputs/buttons/IconButton'
import useIsDesktop from '@/utils/hooks/useIsDesktop'
import { useTheme } from '@/theme/ThemeProvider'
import AdultModeToggle from "@/ui/components/adult-mode-toggle/AdultModeToggle";

interface UserNavProps extends React.HTMLAttributes<HTMLDivElement> {
  onCallClick?: () => void;
  onMenuClick?: () => void;
  adultMode?: boolean;
  callMode?: boolean;
  onAdultModeChange?: (checked: boolean) => void;
  minutesRemaining?: number;
}


const UserNav: React.FC<UserNavProps> = ({ onCallClick, onMenuClick, adultMode, callMode, onAdultModeChange, minutesRemaining }) => {
  const isMobile = useIsDesktop() === false;
  const { theme, setTheme } = useTheme();
  useEffect(() => {
    if (typeof adultMode === "boolean") {
      setTheme(adultMode ? 'adult' : 'default');
    }
  }, [adultMode, setTheme]);

  return (
    <div className={styles.bar}>
      <div className={styles.maxWidthSpacer}>
        {isMobile && (<div
          onClick={onMenuClick}
          className={styles.menuButton}
        >
          <SvgPack.Menu className={styles.menuButtonIcon} />
        </div>)}


        {onAdultModeChange && (
          <AdultModeToggle
            checked={theme === 'adult'}
            onChange={(checked) => {
              onAdultModeChange(checked);
            }}
            minutesLeft={minutesRemaining}
          />
        )}
        <div className={styles.logoArea}>
          <TeaseMeLogo variant="full" />
        </div>
        <div className={styles["right-buttons"]}>
          {!adultMode && <IconButton leftIcon={callMode ? <SvgPack.Call /> : <SvgPack.Chat />} onClick={onCallClick} className={styles.callButton} color='black' text={isMobile ? "" : "Mode"} />}
        </div>
      </div>
    </div>
  )

}

export default UserNav;