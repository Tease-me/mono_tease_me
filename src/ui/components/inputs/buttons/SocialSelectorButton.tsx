import React from "react";
import clsx from "clsx";
import styles from "./SocialSelectorButton.module.css";

type SocialSelectorState = "idle" | "selected" | "error";

export interface SocialSelectorButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
  icon: string;
  iconActive?: string;
  iconError?: string;
  state?: SocialSelectorState;
  activeColor?: string;
}

const SocialSelectorButton: React.FC<SocialSelectorButtonProps> = ({
  label,
  icon,
  iconActive,
  iconError,
  state = "idle",
  className,
  ...rest
}) => {
  const isSelected = state === "selected";
  const isError = state === "error";

  const renderIcon = isError
    ? iconError || icon
    : isSelected
    ? iconActive || icon
    : icon;

  return (
    <button
      type="button"
      {...rest}
      className={clsx(
        styles.button,
        isSelected && styles.selected,
        isError && styles.error,
        className
      )}
    >
      <div className={styles.content}>

        <img className={styles.brandIcon} src={renderIcon} alt={label} />
        <span className={styles.label}>{label}</span>
      </div>
    </button>
  );
};

export default SocialSelectorButton;
