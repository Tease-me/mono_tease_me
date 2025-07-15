import React from "react";
import { useNavigate } from "react-router-dom";
import oliviaImage from "../assets/image/avatar.png";
import oliviaVideo from "../assets/video/avatar_video.mp4";
import BackgroundGradient from "../templates/BackgroundGradient";
import styles from "./WelcomeScreen.module.css";
import ProfileMedia from "@/components/ProfileMedia";
import teaseMeLogo from "@/assets/LogoTeaseMe-Light.svg";
import CenteredLayout from "@/templates/CenteredLayout";
import CircularIconButton from "@/components/buttons/CircularIconButton";
export interface WelcomeScreenProps {
  name: string;
}

export default function WelcomeScreen({ name }: WelcomeScreenProps) {
  const navigate = useNavigate();
  const handleSignInClick = () => {
    navigate("/login");
  };
  return (
    <BackgroundGradient>
      <CenteredLayout className={styles["welcome-screen-container"]}>
        <ProfileMedia className={styles["profile-container"]} videoSrc={oliviaVideo} imageSrc={oliviaImage} showHearts active size="xlarge" />
        <h2 className={styles["join-text"]}>Join {name} on</h2>
        <img src={teaseMeLogo} alt="Olivia" className={styles["logo"]} />
        <p className={styles["signup-text"]}>
          Don't have an account?{" "}
          <span
            className={styles["signup-link"]}
            onClick={() => navigate("/signup")}
            style={{ cursor: "pointer", color: "#ff4d6d" }}>
            Sign up
          </span>
        </p>

        <div className={styles["divider"]}>
          <span>or</span>
        </div>
        <CircularIconButton text="Sign in with email" className={styles["sign-in-button"]} onClick={handleSignInClick} />
      </CenteredLayout>
    </BackgroundGradient>
  );
}
