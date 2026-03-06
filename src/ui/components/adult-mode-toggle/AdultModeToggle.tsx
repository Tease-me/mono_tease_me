import clsx from "clsx";
import styles from "./AdultModeToggle.module.css";
import LipsIcon from "@/assets/svg/angel_lips.svg?react";
import HorneyLips from "@/assets/svg/devil_lips.svg?react";
import { minutesToTime } from "@/utils/DateTimeUtils";
import { ADULT_MODE_AVAILABLE } from "@/constants/adultModeAvailable";

interface AdultModeToggleProps {
  checked: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
  className?: string;
  minutesLeft?: number;
}

const AdultModeToggle: React.FC<AdultModeToggleProps> = ({ minutesLeft, checked, onChange, disabled, className }) => {
  const handleToggle = () => {
    if (!disabled) {
      onChange(!checked);
    }
  };

  return (
    <div className={clsx(styles.adultModeToggleContainer, !ADULT_MODE_AVAILABLE && styles.toggleOnly)}>
      {ADULT_MODE_AVAILABLE && (
        <div className={clsx(styles.minutesArea, checked ? styles.minutesEnabled : styles.minutesDisabled)}>
          <span>{minutesLeft ? minutesToTime(minutesLeft) : "0"} mins</span>
        </div>
      )}
      <div className={styles.toggleArea} onClick={handleToggle}
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
        <div className={clsx(className, disabled && styles.disabled, styles.pill, checked && styles.pillActive)}>
          <span className={clsx(styles.rightIcon, checked && styles.rightIconActive)}>
            {checked ? <HorneyLips className={styles.lipsIcon} /> : <LipsIcon className={styles.lipsIcon} />}
          </span>
        </div>
        <div className={clsx(className, disabled && styles.disabled, styles.pillLabel, checked && styles.pillLabelActive)}>
          <span className={clsx(styles.label, checked && styles.labelActive)}>18+</span>
        </div>
      </div>
    </div>
  );
};

export default AdultModeToggle;
