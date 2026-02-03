import React, { useContext, useEffect, useState, useMemo } from "react";

import { AuthContext } from "@/context/AuthContext";
import { InfluencerDataModel } from "@/data/models/InfluencerDataModel";
import { InfluencerRepo } from "@/data/repositories/InfluencerRepo";
import BlockingLoader from "@/ui/components/loading/BlockingLoader";
import { useNavigate, useParams } from "react-router-dom";
import WelcomeScreen from "./welcome/WelcomeScreen";
import logger from "@/utils/logger";


import { FollowServices } from "@/api/services/FollowServices";
import { apiClient } from "@/api/apis";
import DisclaimerModal from "@/ui/components/modals/DisclaimerModal";
import { Paths } from "@/routes/path";
import { LocalStorageKeys } from "@/constants/localStorageKeys";
import { storage } from "@/utils/storage";

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

  const [showDisclaimer, setShowDisclaimer] = useState(false);

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
          logger.error(err);
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

  useEffect(() => {
    if (screenState !== "welcome") return;
    if (!storage.getBoolean(LocalStorageKeys.DisclaimerSeen)) {
      setShowDisclaimer(true);
    }
  }, [screenState, username]);

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
      <DisclaimerModal
        isOpen={showDisclaimer}
        onClose={() => setShowDisclaimer(false)}
        onEnter={() => {
          storage.setBoolean(LocalStorageKeys.DisclaimerSeen, true);
          setShowDisclaimer(false);
        }}
        onExit={() => {
          setScreenState("loading");
          navigate(Paths.underage)
        }}
      />
      <WelcomeScreen
        influencer={influencer!}
        showFollowBtn={isSignedIn}
      />
    </>
  );
};

export default InfluencerProfileScreen;
