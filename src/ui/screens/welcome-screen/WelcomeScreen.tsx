import React, { useContext, useEffect, useState } from "react";
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

export interface WelcomeScreenProps {
}

export default function WelcomeScreen({ }: WelcomeScreenProps) {
  const navigate = useNavigate();
  const { username } = useParams<{ username: string }>();
  const { isSignedIn } = useContext(AuthContext);
  const [isFirstTime, setIsFirstTime] = useState(false);

  useEffect(() => {
    if (storage.getBoolean(LocalStorageKeys.VisitedWelcome)) {
      setIsFirstTime(true)
      return
    }
    setIsFirstTime(false);
  }, [])

  useEffect(() => {
    if (isSignedIn) navigate("/home")
    return
  }, [isSignedIn])

  const handleSignInClick = () => {
    navigate("/login");
  };

  const handleTryClick = () => {
    storage.setBoolean(LocalStorageKeys.VisitedWelcome, true)
  }

  return (
    <BackgroundGradient>
      <CenteredLayout className={styles["welcome-screen-container"]}>
        {username && (
          <>
            <ProfileMedia className={styles["profile-container"]} videoSrc={oliviaVideo} imageSrc={oliviaImage} showHearts active size="xlarge" />
            <h2 className={styles["join-text"]}>Join {username} on</h2>
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
        {isFirstTime ? <CircularIconButton text="Sign in with email" className={styles["sign-in-button"]} onClick={handleSignInClick} /> :
          <CircularIconButton text="Talk To Me Now" onClick={handleTryClick} />}
      </CenteredLayout>
    </BackgroundGradient>
  );
}
