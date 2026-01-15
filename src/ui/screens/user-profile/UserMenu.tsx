import React, { useContext } from 'react';
import NavigationRow from '@/ui/components/inputs/buttons/NavigationRow';
import styles from './UserMenu.module.css';
import TeaseMeLogo from '@/ui/components/logos/TeaseMeLogo';
import FadingDivider from '@/ui/components/dividers/FadingDivider';
import SvgPack from '@/utils/SvgPack';
import useIsDesktop from '@/utils/hooks/useIsDesktop';
import { AuthContext } from '@/context/AuthContext';

type UserMenuProps = { goTo: (id: string) => void };


export default function UserMenu({ goTo }: UserMenuProps) {
  const { logout } = useContext(AuthContext);

  const handleUserProfileClick = () => {
    goTo("profile")

  }

  const handlePaymentDetailsClick = () => {
    goTo("payment")
  }

  const handleManageInfluencersClick = () => {
    goTo("influencers")
  }

  const isDesktop = useIsDesktop();

  return (
    <div>
      <div className={styles.header}></div>
      {!isDesktop && (
        <div className={styles.logoArea}>
          {<TeaseMeLogo size='large' variant='icon-only-dark' />}
        </div>
      )}
      <div className={styles.menuArea}>
        <NavigationRow title="User Profile" subtitle='Edit & Update User Details' onClick={handleUserProfileClick} />
        <NavigationRow title="Payment Details" subtitle='Add & Edit Payment Sources' onClick={handlePaymentDetailsClick} />
        <NavigationRow title="Manage Influencer" subtitle='Fund, Manage & View Your Influencers' onClick={handleManageInfluencersClick} />
      </div>
      <div className={styles.footer}>
        <FadingDivider />
        <button className={styles.logoutButton} onClick={() => logout()}><SvgPack.Logout />Logout</button>
      </div>

    </div>
  );
}
