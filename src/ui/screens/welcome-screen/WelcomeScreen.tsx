import React, { useContext, useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useParams } from "react-router-dom";
import oliviaImage from "@/assets/image/avatar.png";
import oliviaVideo from "@/assets/video/avatar_video.mp4";
import styles from "./WelcomeScreen.module.css";
import ProfileMedia from "@/ui/components/ProfileMedia";
import CenteredLayout from "@/ui/templates/CenteredLayout";
import CircularIconButton from "@/ui/components/inputs/buttons/CircularIconButton";
import { AuthContext } from "@/context/AuthContext";
import { storage } from "@/utils/storage";
import { LocalStorageKeys } from "@/constants/localStorageKeys";
import DividerWithLabel from "@/ui/components/dividers/DividerWithLabel";
import TeaseMeLogo from "@/ui/components/logos/TeaseMeLogo";
import BackgroundGradient from "@/ui/templates/BackgroundGradient";
import CallIcon from "@/assets/Call.svg?react";
import DropCallIcon from "@/assets/svg/DropCall.svg?react";
import { contacts } from "@/data/mock/contacts";
import { InfluencerDataModel } from "@/data/models/InfluencerDataModel";
export interface WelcomeScreenProps {
}

export default function WelcomeScreen({ }: WelcomeScreenProps) {
  const navigate = useNavigate();
  const { username } = useParams<{ username: string }>();
  const { isSignedIn } = useContext(AuthContext);
  const [isFirstTime, setIsFirstTime] = useState(true);
  const [onTryClicked, setOnTryClicked] = useState(false);
  const [influencer, setInfluencer] = useState<InfluencerDataModel>();
  const audioRef = useRef(new Audio("/audio/ringtone.wav"));


  useEffect(() => {
    audioRef.current.loop = true
    setInfluencer(contacts.find((contact) => contact.username === username));
    setIsFirstTime(!storage.getBoolean(LocalStorageKeys.VisitedWelcome))
  }, [])

  useEffect(() => {
    if (isSignedIn) navigate("/home")
    return
  }, [isSignedIn])

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
    storage.setBoolean(LocalStorageKeys.VisitedWelcome, true);
  }

  const handleHangUpCall = () => {
    storage.setBoolean(LocalStorageKeys.VisitedWelcome, true);
  }

  return (
    <BackgroundGradient>
      <CenteredLayout className={styles["welcome-screen-container"]}>
        {influencer && (
          <>
            <ProfileMedia className={styles["profile-container"]} imageSrc={influencer.img} showHearts active size="xlarge" mediaType="image" />
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
            <div className={styles["call-buttons"]}>
              <CircularIconButton icon={<DropCallIcon />} onClick={handleHangUpCall} size="small" variant="tertiary" />
              <CircularIconButton icon={<CallIcon />} onClick={handlePickUpCall} size="small" />
            </div>}
      </CenteredLayout>
    </BackgroundGradient>
  );
}
