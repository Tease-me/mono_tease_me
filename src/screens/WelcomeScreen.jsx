// screens/WelcomeScreen.jsx
import React from "react";
import { useNavigate } from "react-router-dom";
import oliviaImage from "../assets/image/avatar.png";
import oliviaVideo from "../assets/video/avatar_video.mp4";
import BackgroundGradient from "../components/BackgroundGradient";
import styles from "./WelcomeScreen.module.css";

export default function WelcomeScreen({ name }) {
  const navigate = useNavigate();

  return (
    <div className={styles["welcome-screen"]}>
      <BackgroundGradient />

      <div className={styles["content"]}>
        <div className={styles["profile-container"]}>
          <video autoPlay loop muted className={styles["profile-media"]}>
            <source src={oliviaVideo} type="video/mp4" />
            Your browser doesn't support video.
          </video>

          <div className={styles["hearts-overlay"]}>
            <span className={styles["heart"]}>❤️</span>
            <span className={styles["heart"]}>❤️</span>
            <span className={styles["heart"]}>❤️</span>
          </div>
        </div>

        <h2 className={styles["join-text"]}>Join {name} on</h2>
        <h1 className={styles["brand"]}>
          Tease<span>Me</span>
        </h1>

        <p className={styles["signup-text"]}>
          Don't have an account?{" "}
          <span
            className={styles["signup-link"]}
            onClick={() => navigate("/signup")}
            style={{ cursor: "pointer", color: "#ff4d6d" }}
          >
            Sign up
          </span>
        </p>

        <div className={styles["divider"]}>
          <span>or</span>
        </div>

        <button className={styles["email-button"]} onClick={() => navigate("/login")}>
          Sign in with email
        </button>
      </div>
    </div>
  );
}
