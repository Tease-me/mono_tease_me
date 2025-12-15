import React from "react";
import clsx from "clsx";
import IconButton, { IconButtonProps, IconButtonColor } from "./IconButton";
import styles from "./SocialSelectorButton.module.css";
import checkIcon from "@/assets/svg/iconCheckCircle.svg";

type SocialSelectorState = "idle" | "selected" | "error";

export interface SocialSelectorButtonProps
  extends Omit<IconButtonProps, "color" | "type" | "leftIcon" | "text"> {
  label: string;
  icon: string;
  iconActive?: string;
  iconError?: string;
  state?: SocialSelectorState;
  activeColor?: IconButtonColor; // defaults to green
  showCheck?: boolean;
}

const SocialSelectorButton: React.FC<SocialSelectorButtonProps> = ({
  label,
  icon,
  iconActive,
  iconError,
  state = "idle",
  activeColor = "green",
  showCheck = true,
  className,
  ...rest
}) => {
  const isSelected = state === "selected";
  const isError = state === "error";

  const buttonColor: IconButtonColor = isSelected ? activeColor : "black";
  const renderIcon = isError
    ? iconError || icon
    : isSelected
    ? iconActive || icon
    : icon;

  return (
    <IconButton
      {...rest}
      type="square"
      color={buttonColor}
      selected={isSelected}
      className={clsx(
        styles.wrapper,
        isSelected && styles.stateSelected,
        isError && styles.stateError,
        className
      )}
      text={undefined} // we render our own label inside leftIcon
      leftIcon={
        <div className={styles.content}>
          {isSelected && showCheck && (
            <img className={styles.check} src={checkIcon} alt="" />
          )}
          <img className={styles.brandIcon} src={renderIcon} alt={label} />
          <span className={styles.label}>{label}</span>
        </div>
      }
    />
  );
};

export default SocialSelectorButton;
