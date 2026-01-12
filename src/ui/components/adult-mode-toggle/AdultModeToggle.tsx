import clsx from "clsx";
import styles from "./AdultModeToggle.module.css";
import LipsIcon from "@/assets/svg/angel_lips.svg?react";
import HorneyLips from "@/assets/svg/devil_lips.svg?react";

interface AdultModeToggleProps {
  checked: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
  className?: string;
}

const AdultModeToggle: React.FC<AdultModeToggleProps> = ({ checked, onChange, disabled, className }) => {
  const handleToggle = () => {
    if (!disabled) {
      onChange(!checked);
    }
  };

  return (
    <div className={styles.container} onClick={handleToggle}
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
  );
};

export default AdultModeToggle;
