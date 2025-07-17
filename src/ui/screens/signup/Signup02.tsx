import React from "react";
import { useNavigate } from "react-router-dom";
import BackgroundGradient from "../../templates/BackgroundGradient";
import styles from "./Signup.module.css";

export default function Signup02() {
  const navigate = useNavigate();

  return (
    <div className={styles["auth-container"]}>
      <BackgroundGradient />
      <div className={styles["auth-content"]}>
        <h2 className={styles["auth-title"]}>Fill Your Profile</h2>

        <form className={styles["auth-form"]}>
          <div className={styles["profile-picture-container"]}>
            <div className={styles["profile-picture-placeholder"]}></div>
            <button className={styles["edit-picture-btn"]}>📷</button>
          </div>

          <div className={styles["gender-selection"]}>
            <button type="button" className={styles["gender-btn active"]}>
              Male ♂️
            </button>
            <button type="button" className={styles["gender-btn"]}>
              Female ♀️
            </button>
          </div>

          <input type="text" placeholder="Name" className={styles["auth-input"]} />
          <input
            type="date"
            placeholder="Date of Birth"
            className={styles["auth-input"]}
          />
          <input type="text" placeholder="Nickname" className={styles["auth-input"]} />

          <div className={styles["auth-buttons"]}>
            <button className={styles["btn-back"]} onClick={() => navigate("/signup")}>
              Back
            </button>
            <button
              className={styles["btn-primary"]}
              onClick={() => navigate("/signup/success")}
            >
              Continue
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
