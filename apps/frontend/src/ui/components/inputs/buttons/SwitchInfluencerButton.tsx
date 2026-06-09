import React from "react";
import switchProfileImg from "@/assets/svg/switchProfile.svg";
import styles from "./SwitchInfluencerButton.module.css";
import clsx from "clsx";

interface SwitchInfluencerButtonProps {
  onClick?: () => void;
  className?: string;
  size?: "small" | "large";
  alwaysExpanded?: boolean;
}

const SwitchInfluencerButton: React.FC<SwitchInfluencerButtonProps> = ({ onClick, className, size = "large", alwaysExpanded = false }) => {
  return (
    <button
      type="button"
      className={clsx(styles.button, size === "small" ? styles.small : styles.large, alwaysExpanded && styles.expanded, className)}
      onClick={onClick}
      aria-label="Switch influencer"
    >
      <img src={switchProfileImg} alt="Switch" />
      <div className={clsx(styles.label, alwaysExpanded && styles.labelVisible)}>Switch Influencer</div>
    </button>
  );
};

export default SwitchInfluencerButton;
