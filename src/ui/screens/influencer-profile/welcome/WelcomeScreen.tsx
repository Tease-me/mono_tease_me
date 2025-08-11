import React, { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import styles from "./WelcomeScreen.module.css";
import ProfileMedia from "@/ui/components/ProfileMedia";
import CenteredLayout from "@/ui/templates/CenteredLayout";
import CircularIconButton from "@/ui/components/inputs/buttons/CircularIconButton";
import { storage } from "@/utils/storage";
import { LocalStorageKeys } from "@/constants/localStorageKeys";
import DividerWithLabel from "@/ui/components/dividers/DividerWithLabel";
import TeaseMeLogo from "@/ui/components/logos/TeaseMeLogo";
import BackgroundGradient from "@/ui/templates/BackgroundGradient";
import CallIcon from "@/assets/Call.svg?react";
import DropCallIcon from "@/assets/svg/DropCall.svg?react";
import { InfluencerDataModel } from "@/data/models/InfluencerDataModel";
import useCall from "@/hooks/useCall";

export interface WelcomeScreenProps {
  influencer: InfluencerDataModel;
}

export default function WelcomeScreen({ influencer }: WelcomeScreenProps) {
  const navigate = useNavigate();

  const [isFirstTime, setIsFirstTime] = useState(true);
  const [onTryClicked, setOnTryClicked] = useState(false);
  const { status, startConversation, stopConversation, setInfluencerId } = useCall();

  const audioRef = useRef(new Audio("/audio/ringtone.wav"));

  useEffect(() => {
    if (status === "connected") {
      storage.setBoolean(LocalStorageKeys.VisitedWelcome, true);
    } else if (status === "disconnected") {
      setIsFirstTime(false)
    }
  }, [status])

  useEffect(() => {
    setInfluencerId(influencer?.id);
  }, [influencer])

  const handleSignInClick = () => {
    navigate("/login");
  };

  const handleTryClick = () => {
    audioRef.current.play();
    setOnTryClicked(true)
    setTimeout(() => {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }, 60000);
  };

  const handlePickUpCall = () => {
    audioRef.current.pause();
    startConversation();
  }

  const handleHangUpCall = () => {
    audioRef.current.pause();
    stopConversation();
    setIsFirstTime(false)
  }

  return (
    <BackgroundGradient>
      <CenteredLayout className={styles["welcome-screen-container"]}>
        {influencer && (
          <>
            <ProfileMedia className={styles["profile-container"]} imageSrc={influencer.img} videoSrc={influencer.videoUrl} showHearts active size="xlarge" mediaType="video" />
            <h2 className={styles["join-text"]}>Join {influencer.name} on</h2>
          </>
        )}
        <TeaseMeLogo size="xlarge" />
        <p className={styles["signup-text"]}>
          Don't have an account?{" "}
          <span
            className={styles["signup-link"]}
            onClick={() => navigate("/register")}
            style={{ cursor: "pointer", color: "#ff4d6d" }}>
            Sign up
          </span>
        </p>

        <DividerWithLabel text="or" />
        {!isFirstTime ? <CircularIconButton text="Sign in with email" className={styles["sign-in-button"]} onClick={handleSignInClick} /> :
          !onTryClicked ? <CircularIconButton text="Talk To Me Now" onClick={handleTryClick} /> :
            <>{status === "idle" ? <div className={styles["status"]}>{`${influencer.name} is calling...`}</div> : <div className={styles["status"]}>{status}</div>}
              <div className={styles["call-buttons"]}>
                <CircularIconButton icon={<DropCallIcon />} onClick={handleHangUpCall} size="small" variant="tertiary" />
                {status === "idle" && <CircularIconButton icon={<CallIcon />} onClick={handlePickUpCall} size="small" />}
              </div>
            </>}
      </CenteredLayout>
    </BackgroundGradient>
  );
}
