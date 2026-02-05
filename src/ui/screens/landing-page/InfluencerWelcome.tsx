// InfluencerWelcome.tsx
import clsx from "clsx";
import React, { useContext, useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Howl } from "howler";

import { AuthContext } from "@/context/AuthContext";
import { InfluencerDataModel } from "@/data/models/InfluencerDataModel";
import { InfluencerRepo } from "@/data/repositories/InfluencerRepo";

import IconButton from "@/ui/components/inputs/buttons/IconButton";
import BlockingLoader from "@/ui/components/loading/BlockingLoader";
import TeaseMeLogo from "@/ui/components/logos/TeaseMeLogo";
import ProfileMedia from "@/ui/components/ProfileMedia";
import BackgroundGradient from "@/ui/templates/BackgroundGradient";
import CenteredLayout from "@/ui/templates/CenteredLayout";

import CallIcon from "@/assets/svg/Calling.svg?react";
import DropCallIcon from "@/assets/svg/DropCall.svg?react";

import { LocalStorageKeys } from "@/constants/localStorageKeys";
import useCall from "@/hooks/useCall";
import logger from "@/utils/logger";
import { storage } from "@/utils/storage";

import InfluencerProfile from "../influencer-profile/profile/InfluencerProfile";
import styles from "./InfluencerWelcome.module.css";
import { formatTime } from "@/utils/time";

interface InfluencerWelcomeProps { }

const InfluencerWelcome: React.FC<InfluencerWelcomeProps> = () => {
  const { username } = useParams<{ username: string }>();
  const { isSignedIn } = useContext(AuthContext);
  const navigate = useNavigate();

  const [influencer, setInfluencer] = useState<InfluencerDataModel>();
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [hasConnected, setHasConnected] = useState(false);

  const { status, startConversation, stopConversation, setInfluencerId } =
    useCall();

  const audioRef = useRef(
    new Howl({ src: ["/audio/ringtone.mp3"], loop: true, html5: true })
  );
  const influencerRepo = InfluencerRepo();

  useEffect(() => {
    (async () => {
      try {
        if (username) {
          const localInfluencer = await influencerRepo.getInfluencer(username);
          setInfluencer(localInfluencer);
        } else {
          const localInfluencers = await influencerRepo.getInfluencers();
          if (localInfluencers.length > 0) {
            const randomIndex = Math.floor(
              Math.random() * localInfluencers.length
            );
            const randomInfluencer = localInfluencers[randomIndex];
            setInfluencer(randomInfluencer);
          }
        }
      } catch (err) {
        logger.error(err);
        const localInfluencers = await influencerRepo.getInfluencers();
        if (localInfluencers.length > 0) {
          const randomIndex = Math.floor(
            Math.random() * localInfluencers.length
          );
          const randomInfluencer = localInfluencers[randomIndex];
          setInfluencer(randomInfluencer);
        }
      }
    })();
  }, [username]);

  useEffect(() => {
    if (status === "connected") {
      storage.setBoolean(LocalStorageKeys.VisitedWelcome, true);
      setHasConnected(true);
    }

    if (status === "disconnected" && hasConnected) {
      navigate("/income-dialog");
    }
  }, [status, hasConnected, navigate]);

  useEffect(() => {
    try {
      audioRef.current.play();
    } catch {
      // ignore play errors
    }

    const timeoutId = window.setTimeout(() => {
      audioRef.current.stop();
    }, 60000);

    return () => {
      window.clearTimeout(timeoutId);
      audioRef.current.stop();
    };
  }, []);

  useEffect(() => {
    if (influencer?.id) {
      setInfluencerId(influencer.id);
    }
  }, [influencer, setInfluencerId]);

  useEffect(() => {
    let timer: number | undefined;
    if (status === "connected") {
      setElapsedSeconds(0);
      timer = window.setInterval(() => {
        setElapsedSeconds((prev) => prev + 1);
      }, 1000);
    }
    return () => {
      if (timer) window.clearInterval(timer);
    };
  }, [status]);

  const handlePickUpCall = () => {
    audioRef.current.stop();
    startConversation();
  };

  const handleHangUpCall = () => {
    audioRef.current.stop();
    stopConversation();
  };

  if (!influencer) return <BlockingLoader />;

  if (isSignedIn) {
    return <InfluencerProfile influencer={influencer} />;
  }

  return (
    <BackgroundGradient>
      <CenteredLayout>
        <div className={styles["call-screen-root"]}>
          <TeaseMeLogo
            className={styles["call-logo"]}
            variant="mono-lips-only"
            size="medium"
          />

          <div className={styles["call-avatar-wrapper"]}>
            <ProfileMedia
              className={clsx(styles["call-avatar"])}
              imageSrc={influencer.img}
              videoSrc={influencer.videoUrl}
              active
              size="xlarge"
              mediaType="video"
            />
          </div>

          <h2 className={styles["call-name"]}>{influencer.name}</h2>

          <div className={styles["call-timer"]}>
            {status === "connected" ? formatTime(elapsedSeconds) : "00:00"}
          </div>

          <div className={styles["call-buttons-row"]}>
            {status === "idle" ? (
              // RINGING → single green answer button centered
              <IconButton
                leftIcon={<CallIcon />}
                onClick={handlePickUpCall}
                className={styles["answer-btn"]}
              />
            ) : (
              // CONNECTED → speaker, mic, hangup (no green call)
              <>
                <IconButton leftIcon={<CallIcon />} />
                <IconButton leftIcon={<CallIcon />} />
                <IconButton
                  leftIcon={<DropCallIcon />}
                  onClick={handleHangUpCall}
                />
              </>
            )}
          </div>
        </div>
      </CenteredLayout>
    </BackgroundGradient>
  );
};

export default InfluencerWelcome;
