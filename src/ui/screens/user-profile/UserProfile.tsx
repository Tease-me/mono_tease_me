import React, { useContext, useEffect, useState } from 'react';
import styles from "./UserProfile.module.css"
import ProfileMedia from '@/ui/components/ProfileMedia';
import BackgroundGradient from '@/ui/templates/BackgroundGradient';
import OnBoardingTopNav from '@/ui/components/nav/OnBoardingTopNav';
import TextInput from '@/ui/components/inputs/text-inputs/TextInput';
import FullWidthLayout from '@/ui/templates/FullWidthLayout';

import BalanceView from '@/ui/components/stats/BalanceView';
import VerticalDivider from '@/ui/components/dividers/VerticalDivider';
import logger from '@/utils/logger';
import NormalButton from '@/ui/components/inputs/buttons/NormalButton';
import PrimaryButton from '@/ui/components/inputs/buttons/PrimaryButton';
import PayPalButton from '@/ui/components/inputs/buttons/PayPalButton';
import LinkCardModal from '@/ui/components/modals/payment-modal/LinkCardModal';
import TopUpModal from '@/ui/components/modals/payment-modal/TopUpModal';



import { AuthContext } from '@/context/AuthContext';
import { BalanceServices } from '@/api/services/BalanceServices';
import { formatCentsToDollars } from '@/utils/balance_utils';
import { useNavigate } from 'react-router-dom';
import { apiClient } from '@/api/apis';
import { BalanceResponse } from '@/api/models/balance';

interface UserProfileProps { }

const UserProfile: React.FC<UserProfileProps> = ({ }) => {
    const { user } = useContext(AuthContext);
    const [localUser, setLocalUser] = useState(user);

    const [balance, setBalance] = useState<number>(0);
    const balanceService = BalanceServices(apiClient);
    const [showTopUpModal, setShowTopUpModal] = useState<boolean>(false);
    const [showLinkCardModal, setShowLinkCardModal] = useState<boolean>(false);

    const navigate = useNavigate()

    useEffect(() => {
        balanceService.getBalance().then((response: BalanceResponse) => {
            setBalance(response.balance_cents)
        })
    }, [])

    useEffect(() => {
        if (user)
            setLocalUser(user)
    }, [user])
    const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setLocalUser(prevUser =>
            prevUser ? { ...prevUser, name: e.target.value } : prevUser
        );
    };

    const handleNickNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setLocalUser(prevUser =>
            prevUser ? { ...prevUser, username: e.target.value } : prevUser
        );
    };

    const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setLocalUser(prevUser =>
            prevUser ? { ...prevUser, email: e.target.value } : prevUser
        );
    };

    const handleEditProfileMediaClicked = () => {
        logger.debug("Edit Clicked")
    }

    return (
        <BackgroundGradient>
            <FullWidthLayout fullWidthNav={<OnBoardingTopNav onBackClicked={() => { navigate(-1) }} />}>
                <div className={styles["profile-picture"]}>
                    <ProfileMedia imageSrc={user?.imgUrl} mediaType='image' onEditClick={handleEditProfileMediaClicked} />
                    <VerticalDivider />
                    <BalanceView label='Balance' value={formatCentsToDollars(balance)} />
                </div>
                <div className={styles["section-title"]}>
                    Your Details
                </div>
                <div className={styles["section-body"]}>
                    <div className="profile-row01">
                        <TextInput className={styles["profile-nickname"]} placeholder='Nickname' type='text' value={localUser?.username ? localUser?.username : ""} onChange={handleNickNameChange} />
                    </div>
                    <div className={styles["profile-row02"]}>
                        <TextInput placeholder='Name' type='text' value={localUser?.name ? localUser?.name : ""} onChange={handleNameChange} />
                        <TextInput placeholder='Email' type='email' value={localUser?.email ? localUser?.email : ""} onChange={handleEmailChange} />
                    </div>
                </div>
                <div className={styles["delete-account-section"]}>
                    <a className={styles["profile-delete-account"]} href='#'>Delete Account</a>
                </div>

                <div className={styles["section-title"]}>
                    Payment Details
                </div>
                <div className={styles["payment-row"]}>

                    <PrimaryButton text='Link Card' onClick={() => {
                        setShowLinkCardModal(true);
                    }} />
                    <PayPalButton text='+ Add Funds' onClick={() => {
                        setShowTopUpModal(true);
                    }} />

                </div>
                <div className={styles["update-row"]}>
                    <a className={styles["profile-cancel"]} href='#'>Cancel</a>
                    <NormalButton text='Update Profile' />
                </div>
                <LinkCardModal isOpen={showLinkCardModal} onClose={() => setShowLinkCardModal(false)} />
                <TopUpModal isOpen={showTopUpModal} onClose={() => setShowTopUpModal(false)} />
            </FullWidthLayout>
        </BackgroundGradient>
    );
};

export default UserProfile;