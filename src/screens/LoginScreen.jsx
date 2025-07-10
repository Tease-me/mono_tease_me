import React from "react";
import { useNavigate } from "react-router-dom";
import BackgroundGradient from "../components/BackgroundGradient";
import styles from "./LoginScreen.module.css";

export default function LoginScreen() {
  const navigate = useNavigate();

  return (
    <div className={styles["auth-container"]}>
      <BackgroundGradient />

      <div className={styles["auth-content"]}>
        {" "}
        {/* Adicionado corretamente aqui */}
        <h2 className={styles["auth-title"]}>Login to your Account</h2>
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

          <button
            type="button"
            className={styles["btn-primary"]}
            onClick={() => navigate("/home")}
            style={{ marginTop: "15px" }}
          >
            Sign In
          </button>

          <p className={styles["auth-footer"]}>
            <span>Forgot your password?</span>
          </p>
        </form>
      </div>
    </div>
  );
}
