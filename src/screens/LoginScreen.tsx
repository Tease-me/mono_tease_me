import React, { useContext, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import BackgroundGradient from "../templates/BackgroundGradient";
import styles from "./LoginScreen.module.css";
import { AuthContext } from "@/context/AuthContext";

export default function LoginScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const navigate = useNavigate();
  const { login, authErrors } = useContext(AuthContext);

  useEffect(() => {
    console.log(authErrors);
  }, [authErrors])

  const handleSignInClick = async () => {
    const success = await login(email, password);
    if (success) {
      navigate("/home");
    } else {
      alert("Login failed! Please try again.")
    }
  }
  return (
    <div className={styles["auth-container"]}>
      <BackgroundGradient />

      <div className={styles["auth-content"]}>
        {" "}
        <h2 className={styles["auth-title"]}>Login to your Account</h2>
        <form className={styles["auth-form"]}>
          <input
            type="email"
            placeholder="Email"
            className={styles["auth-input"]}
            value={email}
            onChange={e => setEmail(e.target.value)}
          />
          <input
            type="password"
            placeholder="Password"
            className={styles["auth-input"]}
            value={password}
            onChange={e => setPassword(e.target.value)}
          />

          <label className={styles["auth-checkbox"]}>
            <input type="checkbox" /> Remember me
          </label>

          <button
            type="button"
            className={styles["btn-primary"]}
            onClick={handleSignInClick}
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
