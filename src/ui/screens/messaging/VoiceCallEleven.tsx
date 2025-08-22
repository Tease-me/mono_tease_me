import React, { useEffect, useState } from "react";
import BackgroundGradient from "@/ui/templates/BackgroundGradient";
import CenteredLayout from "@/ui/templates/CenteredLayout";
import CallIcon from "@/assets/Call.svg?react";
import CloseSquareIcon from "@/assets/CloseSquare.svg?react";
import WifiIcon from "@/assets/Wifi.svg?react";
import NoSignalIcon from "@/assets/svg/NoSignal.svg?react";
import { InfluencerDataModel } from "@/data/models/InfluencerDataModel";
import { InfluencerRepo } from "@/data/repositories/InfluencerRepo";
import ProfileMedia from "@/ui/components/ProfileMedia";
import LoadingSpinner from "@/ui/components/loading/LoadingSpinner";
import OnBoardingTopNav from "@/ui/components/nav/OnBoardingTopNav";
import { truncateLastName } from "@/utils/StringUtils";
import { useLocation, useNavigate } from "react-router-dom";
import useCall from "@/hooks/useCall";

import styles from "./VoiceCallEleven.module.css";
import useOnlineStatus from "@/hooks/useOnlineStatus";
import IconButton from "@/ui/components/inputs/buttons/IconButton";

interface VoiceCallElevenProps { }

const VoiceCallEleven: React.FC<VoiceCallElevenProps> = ({ }) => {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);

  const [influencer, setInfluencer] = useState<InfluencerDataModel>();

  const { status, startConversation, stopConversation, setInfluencerId } = useCall();
  const { state } = useLocation();

  const influencerRepo = InfluencerRepo();
  const isOnline = useOnlineStatus()

  useEffect(() => {
    const { influencer_id } = state as { influencer_id: string };
    (async () => {
      if (influencer_id) {
        setIsLoading(true);
        const influencer = await influencerRepo.getInfluencer(influencer_id);
        setInfluencer(influencer);
        setIsLoading(false);
        setInfluencerId(influencer_id)
      }
    })();
  }, [state])

  const handleVoiceToggle = async () => {
    if (status === "connected") {
      stopConversation();
    } else {
      startConversation();
    }
  };

  return (
    <BackgroundGradient>
      <OnBoardingTopNav onBackClicked={() => navigate(-1)} />
      <CenteredLayout>
        {influencer ? (
          <div className={styles["main-container"]}>
            <div className={styles["voice-chat-header"]}>
              <ProfileMedia
                mediaType="video"
                imageSrc={influencer.img}
                videoSrc={influencer.videoUrl}
                showHearts
                size="xlarge"
                active
              />
              <div className={styles["name"]}>
                {truncateLastName(influencer?.name)}
              </div>
              <div className={styles["status-container"]}>{status}</div>
            </div>
            <div className={styles["voice-chat-body"]}>
              <IconButton
                onClick={handleVoiceToggle}
                disabled={isLoading}
                leftIcon={status === "connected" ? <CloseSquareIcon /> : <CallIcon />}
              />
              <div>
                {status === "connected" ? (
                  <div className="flex justify-center items-center space-x-1">
                  </div>
                ) : (
                  !isLoading && (
                    <div className={styles["network-status-container"]}>
                      {isOnline ? (
                        <WifiIcon />
                      ) : (
                        <NoSignalIcon />
                      )}
                      <span className={styles["network-status-text"]}>
                        {isOnline ? "Ready to start" : "No Connection"}
                      </span>
                    </div>
                  )
                )}
              </div>

              {status === "error" && (
                <div>
                  "Something went wrong!"
                </div>
              )}
            </div>
          </div>
        ) : (
          <LoadingSpinner />
        )}
      </CenteredLayout>
    </BackgroundGradient>
  );
};

export default VoiceCallEleven;
