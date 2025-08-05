import React, { useContext } from 'react';
import styles from "./UserProfile.module.css"
import ProfileMedia from '@/ui/components/ProfileMedia';
import profileImage from "@/assets/image/avatar.png"
import BackgroundGradient from '@/ui/templates/BackgroundGradient';
import OnBoardingTopNav from '@/ui/components/nav/OnBoardingTopNav';
import StatCard from '@/ui/components/stats/StatCard';
import TextInput from '@/ui/components/inputs/text-inputs/TextInput';
import FullWidthLayout from '@/ui/templates/FullWidthLayout';
import { AuthContext } from '@/context/AuthContext';

interface UserProfileProps { }

const UserProfile: React.FC<UserProfileProps> = ({ }) => {
    const { user } = useContext(AuthContext);
    return (
        <BackgroundGradient>
            <FullWidthLayout fullWidthNav={<OnBoardingTopNav onBackClicked={() => { }} />}>
                <ProfileMedia imageSrc={profileImage} mediaType='image' />
                <div className={styles["section-body"]}>
                    <StatCard label="Balance" value="$800" />
                </div>
                <div className={styles["section-title"]}>
                    Your Details
                </div>
                <div className={styles["section-body"]}>
                    <TextInput placeholder='Name' type='text' value={user?.name} />
                    <TextInput placeholder='Nickname' type='text' value={user?.username} />
                    <TextInput placeholder='Email' type='email' value={user?.email} />
                </div>
            </FullWidthLayout>
        </BackgroundGradient>
    );
};

export default UserProfile;