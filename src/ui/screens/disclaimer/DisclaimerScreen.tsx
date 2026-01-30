import React from "react";
import styles from "./DisclaimerScreen.module.css";
import NormalButton from "@/ui/components/inputs/buttons/NormalButton";
import PrimaryButton from "@/ui/components/inputs/buttons/PrimaryButton";
import { useNavigate } from "react-router-dom";

const DisclaimerScreen: React.FC = () => {
  const navigate = useNavigate();

  const handleEnter = () => {
    // example: save consent
    localStorage.setItem("adultConfirmed", "true");
    navigate("/signup"); // or wherever your main app is
  };

  const handleExit = () => {
    window.location.href = "https://www.google.com";
  };

  return (
    <div className={styles["disclaimer-screen"]}>
      <div className={styles["disclaimer-container"]}>
        <div className={styles["disclaimer-logo"]}>
          <img src="/logo.png" alt="logo" />
        </div>

        <div className={styles["text-block"]}>
          <div className={styles["d-title"]}>This is an adult website</div>
          <div className={styles["subline"]}>
            This website contains age-restricted materials including nudity and
            explicit depictions of sexual activity. By entering, you affirm that
            you are at least 18 years of age or the age of majority in the
            jurisdiction you are accessing the website from and you consent to
            viewing sexually explicit content.
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
    </div>
  );
};

export default DisclaimerScreen;
