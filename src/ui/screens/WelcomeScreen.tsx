import React from "react";
import { useNavigate } from "react-router-dom";
import { useParams } from "react-router-dom";
import oliviaImage from "@/assets/image/avatar.png";
import oliviaVideo from "@/assets/video/avatar_video.mp4";
import BackgroundGradient from "../templates/BackgroundGradient";
import styles from "./WelcomeScreen.module.css";
import ProfileMedia from "@/ui/components/ProfileMedia";
import CenteredLayout from "@/ui/templates/CenteredLayout";
import CircularIconButton from "@/ui/components/buttons/CircularIconButton";
import TeaseMeLogo from "../components/logos/TeaseMeLogo";
export interface WelcomeScreenProps {
}

export default function WelcomeScreen({ }: WelcomeScreenProps) {
  const navigate = useNavigate();
  const { username } = useParams<{ username: string }>();
  const handleSignInClick = () => {
    navigate("/login");
  };
  return (
    <BackgroundGradient>
      <CenteredLayout className={styles["welcome-screen-container"]}>
        {username && (
          <>
            <ProfileMedia className={styles["profile-container"]} videoSrc={oliviaVideo} imageSrc={oliviaImage} showHearts active size="xlarge" />
            <h2 className={styles["join-text"]}>Join {username} on</h2>
          </>
        )}
        <TeaseMeLogo />
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
