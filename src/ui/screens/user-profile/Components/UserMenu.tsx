import React from 'react';
import NavigationRow from '@/ui/components/inputs/buttons/NavigationRow';
import styles from './UserMenu.module.css';
import TeaseMeLogo from '@/ui/components/logos/TeaseMeLogo';
import FadingDivider from '@/ui/components/dividers/FadingDivider';


export default function UserMenu() {

  const handleUserProfileClick = () => {

  }

  const handlePaymentDetailsClick = () => {
  }

  const handleManageInfluencersClick = () => {
  } 

  return (
    <div>
      <div className={styles.header}></div>
      <div className={styles.logoArea}>
        {<TeaseMeLogo size='large' variant='icon-only-dark' />}
      </div>
      <div className={styles.menuArea}>
      <NavigationRow title="User Profile" subtitle='Edit & Update User Details' onClick={handleUserProfileClick} />
      <NavigationRow title="Payment Details" subtitle='Add & Edit Payment Sources' onClick={handlePaymentDetailsClick} />
      <NavigationRow title="Manage Influencer" subtitle='Fund, Manage & View Your Influencers' onClick={handleManageInfluencersClick} />
      </div>
      <div className={styles.footer}>
        <FadingDivider />

      
      </div>

    </div>
  );
}
