import React from 'react'
import {useContext} from 'react'
import { AuthContext } from '@/context/AuthContext'
import styles from './UserNav.module.css'
import TeaseMeLogo from '../logos/TeaseMeLogo'
import SvgPack from '@/utils/SvgPack'
import IconButton from '../inputs/buttons/IconButton'
import useIsDesktop from '@/utils/hooks/useIsDesktop'
import AdultModeToggle from "@/ui/components/adult-mode-toggle/AdultModeToggle";

interface UserNavProps extends React.HTMLAttributes<HTMLDivElement> {
  onCallClick?: () => void;
  onMenuClick?: () => void;
  influencerName: string;
}


const UserNav: React.FC<UserNavProps> = ({ onCallClick, influencerName, onMenuClick }) => {


  const isMobile = useIsDesktop()===false;
  const {adultMode, setAdultMode} = useContext(AuthContext);

const handleOnChangeAdultToggle = (value: boolean) => {
  setAdultMode(value);
};


  return (
    <div className={styles.bar}>
      {isMobile && (<IconButton
        onClick={onMenuClick}
        className={styles.menuButton}
        type="square"
        color="black"
        leftIcon={<SvgPack.Menu />
        }
      />)}

      <AdultModeToggle checked={adultMode} onChange={handleOnChangeAdultToggle}/>

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