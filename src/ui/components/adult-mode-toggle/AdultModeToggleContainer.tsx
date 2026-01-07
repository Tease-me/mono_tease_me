import clsx from "clsx";
import styles from "./AdultModeToggleContainer.module.css";
import LipsIcon from "@/assets/svg/angel_lips.svg?react";

interface AdultModeToggleContainerProps {
  checked: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
  className?: string;
}

const AdultModeToggleContainer: React.FC<AdultModeToggleContainerProps> = ({ checked, onChange, disabled, className }) => {
  const handleToggle = () => {
    if (!disabled) {
      onChange(!checked);
    }
  };

  return (

    <div className={clsx(className, disabled && styles.disabled, styles.pill, checked && styles.pillActive)}
      onClick={handleToggle}
      role="button"
      aria-pressed={checked}
      aria-disabled={disabled}
      tabIndex={disabled ? -1 : 0}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          handleToggle();
        }
      }}>
      <>
        <span>18+</span>
        <span className={clsx(styles.rightIcon, checked && styles.rightIconActive)}>
          <LipsIcon className={styles.lipsIcon} />
        </span>
      </>
    </div>
  );
};

export default AdultModeToggleContainer;
