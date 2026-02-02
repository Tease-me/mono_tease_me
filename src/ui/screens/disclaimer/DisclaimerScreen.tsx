import React from "react";
import styles from "./DisclaimerScreen.module.css";
import NormalButton from "@/ui/components/inputs/buttons/NormalButton";
import PrimaryButton from "@/ui/components/inputs/buttons/PrimaryButton";
import TeaseMeLogo from '@/ui/components/logos/TeaseMeLogo';
import { useNavigate } from "react-router-dom";

type DisclaimerScreenProps = {
  onEnter?: () => void;
  onExit?: () => void;
};

const DisclaimerScreen: React.FC<DisclaimerScreenProps> = ({
  onEnter,
  onExit
}) => {
  const navigate = useNavigate();

  const handleEnter = () => {
    if (onEnter) {
      onEnter();
      return;
    }
    localStorage.setItem("adultConfirmed", "true");
    navigate("/signup");
  };

  const handleExit = () => {
    if (onExit) {
      onExit();
      return;
    }
    window.location.href = "https://www.google.com";
  };

  return (
    <div className={styles["disclaimer-container"]}>
      <div className={styles["disclaimer-logo"]}>
        <TeaseMeLogo variant='full' size='large' />
      </div>

      <div className={styles["text-block"]}>
        <div className={styles["d-title"]}>This is an adult website</div>
        <div className={styles["subline"]}>
          TeaseMe contains age-restricted materials including explicit verbal descriptions of nudity and sexual activity. By using this service, you affirm that you are at least 18 years of age or the age of majority in your jurisdiction and consent to engaging with sexually explicit textual & voice content.
        </div>
      </div>

      <div className={styles["button-block"]}>
        <PrimaryButton
          className={styles["btn-enter"]}
          text="I am over 18 - Enter"
          onClick={handleEnter}
        />

        <NormalButton
          className={styles["btn-exit"]}
          text="I am under 18 - Exit"
          color="black"
          onClick={handleExit}
        />
      </div>
    </div>
  );
};

export default DisclaimerScreen;
