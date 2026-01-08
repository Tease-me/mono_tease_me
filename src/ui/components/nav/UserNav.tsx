import React from 'react'
import styles from './UserNav.module.css'
import TeaseMeLogo from '../logos/TeaseMeLogo'
import SvgPack from '@/utils/SvgPack'
import IconButton from '../inputs/buttons/IconButton'

interface UserNavProps extends React.HTMLAttributes<HTMLDivElement> {
  onCallClick?: () => void;
  onMenuClick?: () => void;
  influencerName: string;
}


const UserNav: React.FC<UserNavProps> = ({ onCallClick, influencerName, onMenuClick }) => {


  return (
    <div className={styles.bar}>
      <IconButton
        onClick={onMenuClick}
        className={styles.menuButton}
        type="square"
        color="black"
        leftIcon={<SvgPack.Menu />
        }
      />

      <div className={styles.toggleArea}>
      </div>
      <div className={styles.logoArea}>
        <TeaseMeLogo variant="full" />
      </div>


      <div className={styles["right-buttons"]}>
        <div>
          <IconButton leftIcon={<SvgPack.Call />} onClick={onCallClick} className={styles.callButton} color='green' text={`Call ${influencerName}`} />
          <IconButton leftIcon={<SvgPack.Call />} onClick={onCallClick} className={styles.callButtonSmall} color='green' />
        </div>


      </div>
    </div>
  )

}

export default UserNav;