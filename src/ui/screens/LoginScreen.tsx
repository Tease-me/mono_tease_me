import React, { useContext, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import BackgroundGradient from "../templates/BackgroundGradient";
import styles from "./LoginScreen.module.css";
import { AuthContext } from "@/context/AuthContext";
import CenteredLayout from "@/ui/templates/CenteredLayout";
import CircularIconButton from "../components/inputs/buttons/CircularIconButton";
import CheckBox from "../components/inputs/check-boxes/CheckBox";

export default function LoginScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const navigate = useNavigate();
  const { isSignedIn, login, authErrors } = useContext(AuthContext);

  useEffect(() => {
    console.log(authErrors);
  }, [authErrors])

  useEffect(() => {
    if (isSignedIn) {
      navigate("/home");
    }
  }, [isSignedIn])

  const handleSignInClick = async () => {
    const success = await login(email, password);
    if (success) {
      navigate("/home");
    } else {
      alert("Login failed! Please try again.")
    }
  }
  return (
    <BackgroundGradient>
      <CenteredLayout>
        <div className={styles["auth-container"]}>
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
              <CheckBox>Remember Me</CheckBox>
              <CircularIconButton text="Sign In" size="small" onClick={handleSignInClick} />
              <p className={styles["auth-footer"]}>
                <span>Forgot your password?</span>
              </p>
            </form>
          </div>
        </div>
      </CenteredLayout>
    </BackgroundGradient>
  );
}
