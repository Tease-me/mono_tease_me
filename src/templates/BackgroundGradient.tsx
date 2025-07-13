import React from "react";
import styles from "./BackgroundGradient.module.css";

export interface BackgroundGradientProps extends React.HTMLAttributes<HTMLDivElement> { }

export default function BackgroundGradient({ ...restProps }) {
  return <div className={styles["background-gradient"]}>
    {restProps.children}
  </div>;
}
