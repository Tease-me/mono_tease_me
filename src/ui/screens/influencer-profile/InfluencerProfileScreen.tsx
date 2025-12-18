import React, { useContext, useEffect, useState } from 'react';

import { useNavigate, useParams } from 'react-router-dom';
import { AuthContext } from '@/context/AuthContext';
import { InfluencerDataModel } from '@/data/models/InfluencerDataModel';
import { InfluencerRepo } from '@/data/repositories/InfluencerRepo';
import WelcomeScreen from './welcome/WelcomeScreen';
import InfluencerProfile from './profile/InfluencerProfile';
import logger from '@/utils/logger';

interface InfluencerProfileScreenProps { }

const InfluencerProfileScreen: React.FC<InfluencerProfileScreenProps> = ({ }) => {
    const { username } = useParams<{ username: string }>();
    const { isSignedIn } = useContext(AuthContext);

    const [influencer, setInfluencer] = useState<InfluencerDataModel>();

    const influencerRepo = InfluencerRepo();
    const navigate = useNavigate();

    useEffect(() => {
        (async () => {
            if (username) {
                try {
                    const localInfluencer = await influencerRepo.getInfluencer(username)
                    if (!localInfluencer) {
                        navigate("/")
                    }
                    setInfluencer(localInfluencer);
                } catch (err) {
                    logger.error(err)
                    navigate("/")
                }
            } else {
                navigate("/")
            }
        })()
    }, [])

    return <>{!isSignedIn ? <WelcomeScreen influencer={influencer!} /> : <InfluencerProfile influencer={influencer!} />}</>;
};

export default InfluencerProfileScreen;