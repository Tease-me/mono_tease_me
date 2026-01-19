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
  onAdultModeChange?: (checked: boolean) => void;
}


const UserNav: React.FC<UserNavProps> = ({ onCallClick, onMenuClick, adultMode, onAdultModeChange }) => {
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
        {isMobile && (<IconButton
          onClick={onMenuClick}
          className={styles.menuButton}
          type="square"
          color="black"
          leftIcon={<SvgPack.Menu />
          }
        />)}

        {onAdultModeChange && (
          <AdultModeToggle
            checked={theme === 'adult'}
            onChange={(checked) => {
              onAdultModeChange(checked);
            }}
          />
        )}
        <div className={styles.logoArea}>
          <TeaseMeLogo variant="full" />
        </div>
        <div className={styles["right-buttons"]}>
          <div>
            <IconButton leftIcon={<SvgPack.Call />} onClick={onCallClick} className={styles.callButton} color='black' text="Mode" />
            <IconButton leftIcon={<SvgPack.Call />} onClick={onCallClick} className={styles.callButtonSmall} color='green' />
          </div>
        </div>
      </div>
    </div>
  )

}

export default UserNav;