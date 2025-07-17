import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import BackgroundGradient from "../../templates/BackgroundGradient";
import styles from "./Signup.module.css";
import clsx from "clsx";

export default function Signup03() {
  const navigate = useNavigate();

  useEffect(() => {
    const timer = setTimeout(() => {
      navigate("/home");
    }, 3000); // 3 segundos pra ir para Home automaticamente

    return () => clearTimeout(timer);
  }, [navigate]);

  return (
    <div className={styles["auth-container"]}>
      <BackgroundGradient />
      <div className={clsx(styles["auth-content"], styles["success-screen"])}>
        <div className={styles["success-icon"]}>🎉</div>
        <h2 className={styles["auth-title"]}>Congratulations!</h2>
        <p>Your account is ready to use. You'll be redirected shortly.</p>
        <div className={styles["loading-spinner"]}></div>
      </div>
    </div>
  );
}
