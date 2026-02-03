import React from "react";
import styles from "./UnderageRedirectScreen.module.css";
import TeaseMeLogo from "@/ui/components/logos/TeaseMeLogo";

const UnderageRedirectScreen: React.FC = () => {

  return (
    <div className={styles["underage-screen"]}>
      <div className={styles["underage-container"]}>
        <div className={styles["underage-logo"]}>
          <TeaseMeLogo variant="full" size="large" />
        </div>
        <div className={styles["text-block"]}>
          <div className={styles["title"]}>This website is only intended for users over the age of 18.</div>
        </div>
      </div>
    </div>
  );
};

export default UnderageRedirectScreen;
