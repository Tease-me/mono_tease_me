import React from "react";
import styles from "./AdultModeComingSoon.module.css";
import NormalButton from "@/ui/components/inputs/buttons/NormalButton";
import clsx from "clsx";

interface AdultModeComingSoonProps {
  onBackClicked?: () => void;
  nobg?: boolean;
}

const AdultModeComingSoon: React.FC<AdultModeComingSoonProps> = ({ onBackClicked, nobg }) => {
  return (
    <div className={clsx(styles.container, nobg && styles.nobg)}>
      <p className={styles.accent}>18+ Mode</p>
      <p className={styles.tagline}>Something spicy is coming...</p>
      <h1 className={styles.title}>Coming Soon</h1>
      <p className={styles.sub}>Adult mode will be available very soon. Stay tuned.</p>
      <NormalButton
        type="nobg"
        text="No thank you, take me back"
        onClick={onBackClicked}
        className={styles.back}
      />
    </div>
  );
};

export default AdultModeComingSoon;
