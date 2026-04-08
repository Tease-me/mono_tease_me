import React from "react";
import styles from "./BackgroundGradient.module.css";

export interface BackgroundGradientProps extends React.HTMLAttributes<HTMLDivElement> { }

export default function BackgroundGradient({
  className,
  children,
  ...restProps
}: BackgroundGradientProps) {
  const classes = [styles["background-gradient"], className]
    .filter(Boolean)
    .join(" ");

  return (
    <div {...restProps} className={classes}>
      {children}
    </div>
  );
}
