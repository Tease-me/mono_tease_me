import React, { useContext, useEffect, useState, useMemo } from "react";

import { AuthContext } from "@/context/AuthContext";
import { InfluencerDataModel } from "@/data/models/InfluencerDataModel";
import { InfluencerRepo } from "@/data/repositories/InfluencerRepo";
import BlockingLoader from "@/ui/components/loading/BlockingLoader";
import { useNavigate, useParams } from "react-router-dom";
import WelcomeScreen from "./welcome/WelcomeScreen";
import { showErrorModal } from "@/utils/errorModal";


import { FollowServices } from "@/api/services/FollowServices";
import { apiClient } from "@/api/apis";

interface InfluencerProfileScreenProps { }

const InfluencerProfileScreen: React.FC<
  InfluencerProfileScreenProps
> = ({ }) => {
  const { username } = useParams<{ username: string }>();
  const { isSignedIn } = useContext(AuthContext);

  const [influencer, setInfluencer] = useState<InfluencerDataModel>();

  const influencerRepo = useMemo(() => (InfluencerRepo()), []);
  const navigate = useNavigate();

  const followServices = useMemo(() => (FollowServices(apiClient)), []);
  const [isFollowing, setIsFollowing] = useState<boolean | null>(null);

  //Intial Check
  useEffect(() => {
    (async () => {
      if (username) {
        try {
          const localInfluencer = await influencerRepo.getInfluencer(username);
          if (!localInfluencer) {
            navigate("/");
          }
          setInfluencer(localInfluencer);
        } catch (err: any) {
          showErrorModal(err);
          navigate("/");
        }
      } else {
        navigate("/");
      }
    })();
  }, [username, influencerRepo, navigate]);

  //Check if following
  useEffect(() => {
    if (!isSignedIn || !influencer?.id) {
      setIsFollowing(false);
      return;
    }
    followServices.list()
      .then(({ items }) => {
        setIsFollowing(items.some(f => f.influencer_id === influencer.id && f.following !== false));
      })
      .catch(() => setIsFollowing(false));
  }, [isSignedIn, influencer?.id, followServices]);

  //Redirect if signed in and following 
  useEffect(() => {
    if (isSignedIn && isFollowing && influencer?.id) {
      localStorage.setItem("selected_id", influencer?.id?.toString() || "");
      navigate("/home");
    }
  }, [isSignedIn, isFollowing, influencer?.id, navigate]);


  if (!influencer || (isSignedIn && isFollowing===null)) return <BlockingLoader />;

  return (
    <>
     <WelcomeScreen influencer={influencer!} showFollowBtn={(isSignedIn && isFollowing === false)} />
    </>
  );
};

export default InfluencerProfileScreen;
