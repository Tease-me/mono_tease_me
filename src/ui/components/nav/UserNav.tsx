import React from 'react'
import { useEffect } from 'react'
import styles from './UserNav.module.css'
import TeaseMeLogo from '../logos/TeaseMeLogo'
import SvgPack from '@/utils/SvgPack'
import IconButton from '../inputs/buttons/IconButton'
import { useIsDesktopOnly } from '@/hooks/layout/useIsDesktop'
import { useTheme } from '@/theme/ThemeProvider'
import clsx from 'clsx'

interface UserNavProps extends React.HTMLAttributes<HTMLDivElement> {
  onCallClick?: () => void;
  onMenuClick?: () => void;
  callMode?: boolean;
  title?: string;
  onSwitchInfluencer?: () => void;
  onClose?: () => void;
}

const UserNav: React.FC<UserNavProps> = ({
  onCallClick,
  onMenuClick,
  callMode,
  title,
  onSwitchInfluencer,
  onClose,
}) => {
  const isMobile = useIsDesktopOnly() === false;
  const { setTheme } = useTheme();

  useEffect(() => {
    setTheme('default');
  }, [setTheme]);

  return (
    <div className={styles.bar}>
      <div className={styles.logoLeft}><TeaseMeLogo variant="full" /></div>
      <div className={styles.maxWidthSpacer}>
        <div className={styles.leftSlot}>
          {isMobile && (
            <div onClick={onMenuClick} className={styles.menuButton}>
              <SvgPack.Menu className={styles.menuButtonIcon} />
            </div>
          )}
        </div>

        {onSwitchInfluencer ? (
          <button
            type="button"
            className={styles.switchInfluencerButton}
            onClick={onSwitchInfluencer}
          >
            Switch
          </button>
        ) : title ? (
          <span className={styles.navTitle}>{title}</span>
        ) : (
          <div className={styles.logoArea}><TeaseMeLogo variant="full" /></div>
        )}

        <div className={styles["right-buttons"]}>
          {onCallClick && (
            <IconButton
              leftIcon={callMode
                ? <SvgPack.Chat className={clsx(styles.callChatIcon)} />
                : <SvgPack.Call className={clsx(styles.callCallIcon)} />
              }
              onClick={onCallClick}
              className={styles.callButton}
              color='black'
              text={isMobile ? "" : "Mode"}
            />
          )}
          {onClose && (
            <IconButton
              leftIcon={<SvgPack.Cross className={styles.closeIcon} />}
              onClick={onClose}
              className={styles.closeButton}
              color='black'
            />
          )}
        </div>
      </div>
    </div>
  )
}

export default UserNav;
