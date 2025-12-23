import React, { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import ProfileMedia from "@/ui/components/ProfileMedia";
import CenteredLayout from "@/ui/templates/CenteredLayout";
import { storage } from "@/utils/storage";
import { LocalStorageKeys } from "@/constants/localStorageKeys";
import DividerWithLabel from "@/ui/components/dividers/DividerWithLabel";
import TeaseMeLogo from "@/ui/components/logos/TeaseMeLogo";
import BackgroundGradient from "@/ui/templates/BackgroundGradient";
import CallIcon from "@/assets/svg/Calling.svg?react";
import DropCallIcon from "@/assets/svg/HangupCall.svg?react";
import { InfluencerDataModel } from "@/data/models/InfluencerDataModel";
import useCall from "@/hooks/useCall";
import styles from "./WelcomeScreen.module.css";
import clsx from "clsx";
import WelcomeCallModal from "@/ui/components/modals/welcome-call/WelcomeCallModal";
import PrimaryButton from "@/ui/components/inputs/buttons/PrimaryButton";
import IconButton from "@/ui/components/inputs/buttons/IconButton";
import AnimatedButton from "@/ui/components/inputs/buttons/AnimatedButton";
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

  const handleSignUpClick = () => {
    if (!influencer?.id) return;
    navigate(`/register?influencer_id=${encodeURIComponent(influencer.id)}`);
  };

  {/*}
  const handleTryClick = () => {
    audioRef.current.play();
    setOnTryClicked(true)
    setTimeout(() => {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }, 60000);
  };
  */}

  const handlePickUpCall = () => {
    audioRef.current.pause();
    startConversation();
  }

  const handleHangUpCall = () => {
    audioRef.current.pause();
    stopConversation();
    setIsFirstTime(false)
    setOnTryClicked(false)
  }

  const incomingCall = status === "idle" && onTryClicked;

  return (
    <BackgroundGradient>
      <CenteredLayout>
        {influencer && (
          <>
            <ProfileMedia className={clsx(styles["profile-container"], onTryClicked && styles["zoomed"])} imageSrc={influencer.img} videoSrc={influencer.videoUrl} showHearts={!onTryClicked} active size="xlarge" mediaType="video" />
            {!onTryClicked && <h2 className={styles["join-text"]}>Join {influencer.name} on</h2>}
          </>
        )}

        {incomingCall ? (<>
          <div className={styles["incoming-call-text"]}>Incoming Call</div>
          <div className={styles["influencer-name"]}>{influencer.name}</div>
          <div className={styles["call-buttons"]}>
            <IconButton leftIcon={<DropCallIcon color="red" />} onClick={handleHangUpCall} text="Reject" color="black" />
            <AnimatedButton leftIcon={<CallIcon />} onClick={handlePickUpCall} text="Answer" color="green" />
          </div>
        </>) : <div className={styles["welcome-screen-container"]}>
          <TeaseMeLogo size="xlarge" variant="full-dark" />
          <p className={styles["signup-text"]}>
            Don't have an account?{" "}
            <span
              className={styles["signup-link"]}
              onClick={handleSignUpClick}
              style={{ cursor: "pointer", color: "#ff4d6d" }}>
              Sign up
            </span>
          </p>

          <DividerWithLabel text="or" />
          <div className={styles["buttons-container"]}>
            {!isFirstTime ? <PrimaryButton text="Sign in with email" className={styles["sign-in-button"]} onClick={handleSignInClick} /> :
              <PrimaryButton text="Talk to me Now" onClick={() => {
                startConversation();
                setOnTryClicked(true);
              }} />}
            <p className={styles["signup-text"]}>
              Already have an account?{" "}
              <span
                className={styles["signup-link"]}
                onClick={() => navigate("/login")}
                style={{ cursor: "pointer", color: "#ff4d6d" }}>
                Login
              </span>
            </p>
          </div>
        </div>}
        <WelcomeCallModal isOpen={onTryClicked || status === "connected"} onClose={() => { setOnTryClicked(false) }} influencer={influencer} status={status} stopConversation={stopConversation} />
      </CenteredLayout>
    </BackgroundGradient>
  );
}
