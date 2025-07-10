import React from "react";
import { useNavigate } from "react-router-dom";
import BackgroundGradient from "../../components/BackgroundGradient";
import styles from "./Signup.module.css";

export default function Signup01() {
  const navigate = useNavigate();

  return (
    <div className={styles["auth-container"]}>
      <BackgroundGradient />
      <div className={styles["auth-content"]}>
        <h2 className={styles["auth-title"]}>Create your Account</h2>
        <form className={styles["auth-form"]}>
          <input type="email" placeholder="Email" className={styles["auth-input"]} />
          <input
            type="password"
            placeholder="Password"
            className={styles["auth-input"]}
          />

          <label className={styles["auth-checkbox"]}>
            <input type="checkbox" /> Remember me
          </label>

          <div className={styles["auth-buttons"]}>
            <button className={styles["btn-back"]} onClick={() => navigate("/")}>
              Back
            </button>
            <button
              className={styles["btn-primary"]}
              onClick={() => navigate("/signup/profile")}
            >
              Continue
            </button>
          </div>

          <p className={styles["auth-footer"]}>
            Already have an account?{" "}
            <span onClick={() => navigate("/login")}>Sign in</span>
          </p>
        </form>
      </div>
    </div>
  );
}
