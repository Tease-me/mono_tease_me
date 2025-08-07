import React, { useContext, useEffect, useState } from 'react';
import styles from "./UserProfile.module.css"
import ProfileMedia from '@/ui/components/ProfileMedia';
import profileImage from "@/assets/image/avatar.png"
import BackgroundGradient from '@/ui/templates/BackgroundGradient';
import OnBoardingTopNav from '@/ui/components/nav/OnBoardingTopNav';
import TextInput from '@/ui/components/inputs/text-inputs/TextInput';
import FullWidthLayout from '@/ui/templates/FullWidthLayout';
import { AuthContext } from '@/context/AuthContext';
import { BalanceServices } from '@/api/services/BalanceServices';
import { formatCentsToDollars } from '@/utils/balance_utils';
import CircularIconButton from '@/ui/components/inputs/buttons/CircularIconButton';
import ButtonRow from '@/ui/templates/ButtonRow';
import BalanceView from '@/ui/components/stats/BalanceView';
import VerticalDivider from '@/ui/components/dividers/VerticalDivider';
import { useNavigate } from 'react-router-dom';
import { apiClient } from '@/api/apis';

interface UserProfileProps { }

const UserProfile: React.FC<UserProfileProps> = ({ }) => {
    const { user } = useContext(AuthContext);
    const [localUser, setLocalUser] = useState(user);

    const [balance, setBalance] = useState<number>(0);
    const balanceService = BalanceServices(apiClient);
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
        console.log("Edit Clicked")
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
                <ButtonRow className={styles["button-row"]}>
                    <CircularIconButton text='Discard' variant='tertiary' />
                    <CircularIconButton text='Update' />
                </ButtonRow>
            </FullWidthLayout>
        </BackgroundGradient>
    );
};

export default UserProfile;