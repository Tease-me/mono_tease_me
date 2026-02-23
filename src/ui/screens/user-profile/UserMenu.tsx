import React, { useContext } from 'react';
import NavigationRow from '@/ui/components/inputs/buttons/NavigationRow';
import styles from './UserMenu.module.css';
import TeaseMeLogo from '@/ui/components/logos/TeaseMeLogo';
import FadingDivider from '@/ui/components/dividers/FadingDivider';
import SvgPack from '@/utils/SvgPack';
import useIsDesktop from '@/utils/hooks/useIsDesktop';
import { AuthContext } from '@/context/AuthContext';
import clsx from "clsx"

type UserMenuProps = { goTo: (id: string, payload?: any) => void };


export default function UserMenu({ goTo }: UserMenuProps) {
  const storedId = localStorage.getItem("selected_id");
  const { logout } = useContext(AuthContext);

  const handleUserProfileClick = () => {
    goTo("profile")

  }

  const handlePaymentDetailsClick = () => {
    goTo("payment")
  }

  const handlePTopupClick = () => {
    if (!storedId) return;
    goTo("influencer_profile", {
      influencerId: storedId,
    });
  }

  // const handleManageInfluencersClick = () => {
  //   goTo("influencers")
  // }

  const isDesktop = useIsDesktop();
  return (
    <div className="u-sidebar-page">
      <div className={clsx(styles.container)}>
        <div className={styles.header}></div>
        {!isDesktop && (
          <div className={styles.logoArea}>
            {<TeaseMeLogo size='large' variant='icon-only-dark' />}
          </div>
        )}
        <div className={styles.menuArea}>
          <NavigationRow title="User Profile" subtitle='Edit & Update User Details' onClick={handleUserProfileClick} />
          <NavigationRow title="Payment Details" subtitle='Add & Edit Payment Sources' onClick={handlePaymentDetailsClick} />
          {storedId && (
            <NavigationRow title="Topup" subtitle='Topup your account' onClick={handlePTopupClick} />
          )}
          {/* <NavigationRow title="Manage Influencer" subtitle='Fund, Manage & View Your Influencers' onClick={handleManageInfluencersClick} /> */}
        </div>
      </div>
      <div className="u-sidebar-footer">
        <div className={"u-sidebar-footer"}>
          <FadingDivider />
          <button className={styles.logoutButton} onClick={() => logout()}><SvgPack.Logout />Logout</button>
        </div>
      </div>
    </div>
  );
}
