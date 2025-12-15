import React from "react";
import clsx from "clsx";
import styles from "./ValidationPill.module.css";

type ValidationVariant = "error" | "success" | "warning";

interface ValidationPillProps {
  variant: ValidationVariant;
  children: React.ReactNode;
  className?: string;
}

const ValidationPill: React.FC<ValidationPillProps> = ({
  variant,
  children,
  className,
}) => {
  return (
    <div
      className={clsx(styles.pill, styles[variant], className)}
      role="status"
      aria-live="polite"
    >
      {children}
    </div>
  );
};

export default ValidationPill;
