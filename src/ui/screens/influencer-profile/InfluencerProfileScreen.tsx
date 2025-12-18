import React, { useContext, useEffect, useState } from 'react';

import { useNavigate, useParams } from 'react-router-dom';
import { AuthContext } from '@/context/AuthContext';
import { InfluencerDataModel } from '@/data/models/InfluencerDataModel';
import { InfluencerRepo } from '@/data/repositories/InfluencerRepo';
import WelcomeScreen from './welcome/WelcomeScreen';
import logger from '@/utils/logger';
import BlockingLoader from '@/ui/components/loading/BlockingLoader';

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

    if(isSignedIn){
        localStorage.setItem("selected_id", influencer?.id?.toString() || "");
        navigate("/home")
    }

    if(!influencer) return <BlockingLoader/>

    return <><WelcomeScreen influencer={influencer!} /></>;
};

export default InfluencerProfileScreen;