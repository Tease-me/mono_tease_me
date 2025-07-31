import React, { useContext, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import BackgroundGradient from "../templates/BackgroundGradient";
import styles from "./LoginScreen.module.css";
import { AuthContext } from "@/context/AuthContext";
import CenteredLayout from "@/ui/templates/CenteredLayout";
import CircularIconButton from "../components/inputs/buttons/CircularIconButton";
import CheckBox from "../components/inputs/check-boxes/CheckBox";
import TextInput from "../components/inputs/text-inputs/TextInput";
import MessageIcon from "@/assets/svg/Message.svg?react"
import LockIcon from "@/assets/svg/Lock.svg?react"
import ErrorMessage from "../components/ErrorMessage";
import OnBoardingTopNav from "../components/nav/OnBoardingTopNav";

export default function LoginScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState<string>();

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


  const handleSignInClick = async (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      setErrorMessage("Please enter both email and password.");
      return;
    }
    const success: boolean = await login(email, password);
    if (success) {
      navigate("/home");
    } else {
      setErrorMessage("Login failed! Please try again.")
    }
  }

  return (
    <BackgroundGradient>
      <OnBoardingTopNav />
      <CenteredLayout>
        <div className={styles["auth-container"]}>
          <div className={styles["auth-content"]}>
            <h2 className={styles["auth-title"]}>Login to your Account</h2>
            <form className={styles["auth-form"]}>
              <TextInput
                type="email"
                placeholder="Email"
                className={styles["auth-input"]}
                value={email}
                leftIcon={<MessageIcon />}
                onChange={e => setEmail((e.target as HTMLInputElement).value)}
              />
              <TextInput
                type="password"
                placeholder="Password"
                leftIcon={<LockIcon />}
                className={styles["auth-input"]}
                value={password}
                onChange={e => setPassword((e.target as HTMLInputElement).value)}
              />
              {errorMessage && <ErrorMessage message={errorMessage} />}
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
