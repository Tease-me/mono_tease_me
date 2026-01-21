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


  type ScreenState = "loading" | "welcome" | "redirecting";
  const [screenState, setScreenState] = useState<ScreenState>("loading");

  //Check Influencer.
  useEffect(() => {
    (async () => {
      if (username) {
        try {
          const localInfluencer = await influencerRepo.getInfluencer(username);
          if (!localInfluencer) {
            navigate("/");
            return;
          }
          setInfluencer(localInfluencer);
        } catch (err: any) {
          showErrorModal(err);
          navigate("/");
          return;
        }
      } else {
        navigate("/");
      }
    })();
  }, [username, influencerRepo, navigate]);

  // Check following
  useEffect(() => {
    if (!influencer?.id) return;

    if (!isSignedIn) {
      setScreenState("welcome");
      return;
    }

    followServices
      .list()
      .then(({ items }) => {
        const following = items.some(
          f => f.influencer_id === influencer.id && f.following !== false
        );


        if (following) {
          setScreenState("redirecting");
        } else {
          setScreenState("welcome");
        }
      })
      .catch(() => {
        setScreenState("welcome");
      });
  }, [isSignedIn, influencer?.id, followServices]);

  //Redirect if signed in and following 
  useEffect(() => {
    if (screenState === "redirecting" && influencer?.id) {
      localStorage.setItem("selected_id", influencer.id.toString());
      navigate("/home");
    }
  }, [screenState, influencer?.id, navigate]);

  if (screenState !== "welcome") {
    return <BlockingLoader />;
  }

  return (
    <>
      <WelcomeScreen
        influencer={influencer!}
        showFollowBtn={isSignedIn}
      />
    </>
  );
};

export default InfluencerProfileScreen;
