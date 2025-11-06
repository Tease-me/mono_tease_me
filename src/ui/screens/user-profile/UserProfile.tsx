import React, { useContext, useEffect, useState } from 'react';
import styles from "./UserProfile.module.css"
import ProfileMedia from '@/ui/components/ProfileMedia';
import BackgroundGradient from '@/ui/templates/BackgroundGradient';
import OnBoardingTopNav from '@/ui/components/nav/OnBoardingTopNav';
import TextInput from '@/ui/components/inputs/text-inputs/TextInput';
import FullWidthLayout from '@/ui/templates/FullWidthLayout';
import { AuthContext } from '@/context/AuthContext';
import { BalanceServices } from '@/api/services/BalanceServices';
import { formatCentsToDollars } from '@/utils/balance_utils';
import ButtonRow from '@/ui/templates/ButtonRow';
import BalanceView from '@/ui/components/stats/BalanceView';
import VerticalDivider from '@/ui/components/dividers/VerticalDivider';
import { useNavigate } from 'react-router-dom';
import { apiClient } from '@/api/apis';
import { BalanceResponse } from '@/api/models/balance';
import logger from '@/utils/logger';
import NormalButton from '@/ui/components/inputs/buttons/NormalButton';
import PrimaryButton from '@/ui/components/inputs/buttons/PrimaryButton';
import LinkCardModal from '@/ui/components/modals/payment-modal/LinkCardModal';

interface UserProfileProps { }

const UserProfile: React.FC<UserProfileProps> = ({ }) => {
    const { user } = useContext(AuthContext);
    const [localUser, setLocalUser] = useState(user);

    const [balance, setBalance] = useState<number>(0);
    const balanceService = BalanceServices(apiClient);
    const [showTopUpModal, setShowTopUpModal] = useState<boolean>(false);

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
                    <TextInput placeholder='Name' type='text' value={localUser?.name ? localUser?.name : ""} onChange={handleNameChange} />
                    <TextInput placeholder='Nickname' type='text' value={localUser?.username ? localUser?.username : ""} onChange={handleNickNameChange} />
                    <TextInput placeholder='Email' type='email' value={localUser?.email ? localUser?.email : ""} onChange={handleEmailChange} />
                </div>
                <div className={styles["delete-account-section"]}>
                    <a href='#'>Delete Account</a>
                </div>
                <div className={styles["top-up-button"]}>
                    <PrimaryButton text='TopUp' onClick={() => {
                        setShowTopUpModal(true);
                    }} />
                </div>
                <ButtonRow className={styles["button-row"]}>
                    <NormalButton text='Discard' color='black' />
                    <PrimaryButton text='Update' />
                </ButtonRow>
                <LinkCardModal isOpen={showTopUpModal} onClose={() => setShowTopUpModal(false)} />
            </FullWidthLayout>
        </BackgroundGradient>
    );
};

export default UserProfile;