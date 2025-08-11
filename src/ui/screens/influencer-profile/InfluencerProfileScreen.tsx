import React, { useContext, useEffect, useState } from 'react';

import { useParams } from 'react-router-dom';
import { AuthContext } from '@/context/AuthContext';
import { InfluencerDataModel } from '@/data/models/InfluencerDataModel';
import { InfluencerRepo } from '@/data/repositories/InfluencerRepo';
import WelcomeScreen from './welcome/WelcomeScreen';
import BlockingLoader from '@/ui/components/loading/BlockingLoader';
import InfluencerProfile from './profile/InfluencerProfile';
import logger from '@/utils/logger';

interface InfluencerProfileScreenProps { }

const InfluencerProfileScreen: React.FC<InfluencerProfileScreenProps> = ({ }) => {
    const { username } = useParams<{ username: string }>();
    const { isSignedIn } = useContext(AuthContext);

    const [influencer, setInfluencer] = useState<InfluencerDataModel>();

    const influencerRepo = InfluencerRepo();
    const getRandomInfluencer = async () => {
        const localInfluencers = await influencerRepo.getInfluencers();
        if (localInfluencers.length > 0) {
            const randomIndex = Math.floor(Math.random() * localInfluencers.length);
            const randomInfluencer = localInfluencers[randomIndex];
            setInfluencer(randomInfluencer);
        }
    }
    useEffect(() => {
        (async () => {
            if (username) {
                try {
                    const localInfluencer = await influencerRepo.getInfluencer(username)
                    setInfluencer(localInfluencer);
                } catch (err) {
                    logger.error(err)
                }
            }
            getRandomInfluencer()
        })()
    }, [])

    if (!influencer) <BlockingLoader />

    return <>{!isSignedIn ? <WelcomeScreen influencer={influencer!} /> : <InfluencerProfile influencer={influencer} />}</>;
};

export default InfluencerProfileScreen;