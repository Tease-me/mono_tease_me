import React from "react";
import styles from "./Toggle.module.css";
import clsx from "clsx";

interface ToggleProps {
  checked: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
  className?: string;
}

const Toggle: React.FC<ToggleProps> = ({ checked, onChange, disabled, className }) => {
  return (
    <button
      type="button"
      className={clsx(styles.toggle, checked && styles.checked, disabled && styles.disabled, className)}
      onClick={() => !disabled && onChange(!checked)}
      aria-pressed={checked}
      aria-label="Toggle"
      disabled={disabled}
    >
      <span className={styles.knob} />
    </button>
  );
};

export default Toggle;
