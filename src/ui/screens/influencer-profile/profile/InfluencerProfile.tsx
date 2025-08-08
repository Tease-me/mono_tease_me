import React from 'react';
import styles from "./InfluencerProfile.module.css"
import BackgroundGradient from '@/ui/templates/BackgroundGradient';
import OnBoardingTopNav from '@/ui/components/nav/OnBoardingTopNav';
import ProfileMedia from '@/ui/components/ProfileMedia';

interface InfluencerProfileProps {
}

const InfluencerProfile: React.FC<InfluencerProfileProps> = ({ }) => {
    return (
        <BackgroundGradient>
            <OnBoardingTopNav />
            <div className={styles["container"]}>
                <ProfileMedia />
            </div>
        </BackgroundGradient>

    );
};

export default InfluencerProfile;