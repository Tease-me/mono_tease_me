import React, { useContext, useEffect, useRef, useState } from 'react';

import { useNavigate, useParams } from 'react-router-dom';
import { AuthContext } from '@/context/AuthContext';
import { InfluencerDataModel } from '@/data/models/InfluencerDataModel';
import { InfluencerRepo } from '@/data/repositories/InfluencerRepo';
import WelcomeScreen from './welcome/WelcomeScreen';
import BlockingLoader from '@/ui/components/loading/BlockingLoader';
import InfluencerProfile from './profile/InfluencerProfile';
import styles from "./InfluencerProfileScreen.module.css"

interface InfluencerProfileScreenProps { }

const InfluencerProfileScreen: React.FC<InfluencerProfileScreenProps> = ({ }) => {
    const { username } = useParams<{ username: string }>();
    const { isSignedIn } = useContext(AuthContext);

    const [influencer, setInfluencer] = useState<InfluencerDataModel>();
    const audioRef = useRef(new Audio("/audio/ringtone.wav"));
    const influencerRepo = InfluencerRepo();

    useEffect(() => {
        audioRef.current.loop = true;
        (async () => {
            if (username) {
                try {
                    const localInfluencer = await influencerRepo.getInfluencer(username)
                    setInfluencer(localInfluencer);
                } catch (err) {
                    const localInfluencers = await influencerRepo.getInfluencers();
                    if (localInfluencers.length > 0) {
                        const randomIndex = Math.floor(Math.random() * localInfluencers.length);
                        const randomInfluencer = localInfluencers[randomIndex];
                        setInfluencer(randomInfluencer);
                    }
                }
            }
        })()
    }, [])

    if (!influencer) <BlockingLoader />

    return <>{!isSignedIn ? <WelcomeScreen influencer={influencer!} /> : <InfluencerProfile />}</>;
};

export default InfluencerProfileScreen;