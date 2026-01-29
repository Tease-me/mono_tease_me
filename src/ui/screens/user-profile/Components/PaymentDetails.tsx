import React, { useState } from 'react';
import NavigationRow from '@/ui/components/inputs/buttons/NavigationRow';
import styles from "./PaymentDetails.module.css"
import IconButton from '@/ui/components/inputs/buttons/IconButton';
import SvgPack from '@/utils/SvgPack';
import CardMockup from '@/assets/image/card-mockup.png';

import UpgradePlanModal from '@/ui/components/modals/subscription/UpgradePlanModal';

type PaymentDetailsProps = { goTo: (id: string) => void };

const PaymentDetails = ({ goTo }: PaymentDetailsProps) => {

    const [showUpgradeModal, setShowUpgradeModal] = useState(false);

    const handleVisaBtn = () => {
        // Handle Visa button click
        setShowUpgradeModal(true);
    };

    const handleMasterCardBtn = () => {
        //temporary
        goTo('payment-check');
    };


    const handleAddNew = () => {
        // Handle Add New Payment Method button click
    };


    return (
        <div className="u-sidebar-page">
            <div className={styles.cardPreview}>
                <img src={CardMockup} alt="Card Mockup" className={styles.cardImage} />
            </div>
            <h3 className={styles.sectionTitle}>Saved Payment Method</h3>
            <div className={styles.menu}>
                <NavigationRow title="Visa" subtitle="Default" onClick={handleVisaBtn} />
                <NavigationRow title="MasterCard" subtitle="Backup Method" onClick={handleMasterCardBtn} />
            </div>
            <div className="u-sidebar-footer">
                <div className={styles.addNew}>
                    <IconButton leftIcon={<SvgPack.PlusBox />} text="Add New Payment Method" onClick={handleAddNew} color='pink-glass' className={styles.addButton} />
                </div>
            </div>
            <UpgradePlanModal isOpen={showUpgradeModal} onClose={() => setShowUpgradeModal(false)} />
        </div>
    );
};

export default PaymentDetails;