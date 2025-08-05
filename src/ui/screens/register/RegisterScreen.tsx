import React, { useContext, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import BackgroundGradient from "../../templates/BackgroundGradient";
import styles from "./RegisterScreen.module.css";
import { AuthServices } from "@/api/services/AuthServices";
import CheckBox from "@/ui/components/inputs/check-boxes/CheckBox";
import TextInput from "@/ui/components/inputs/text-inputs/TextInput";
import { RegisterResponse } from "@/api/models/auth";
import CircularIconButton from "@/ui/components/inputs/buttons/CircularIconButton";
import QuestionMarkCircleIcon from "@/assets/svg/QuestionMark.svg?react"
import HeadingText from "@/ui/components/typography/HeadingText";
import { AuthContext } from "@/context/AuthContext";
import OnBoardingTopNav from "@/ui/components/nav/OnBoardingTopNav";
import FullWidthLayout from "@/ui/templates/FullWidthLayout";
import { apiClient } from "@/api/apis";
import ButtonRow from "@/ui/templates/ButtonRow";

export default function RegisterScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [agree, setAgree] = useState(false);

  const [errors, setErrors] = useState<{ email?: string; password?: string, general?: string }>({});
  const authServices = AuthServices(apiClient);
  const { isSignedIn } = useContext(AuthContext);

  const navigate = useNavigate();

  if (isSignedIn) navigate("/home");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors: { email?: string; password?: string, general?: string } = {};
    if (!email.trim()) newErrors.email = "Email is required";
    if (!password) newErrors.password = "Password is required";
    if (!agree) newErrors.general = "Please Agree to NSFW";

    if (Object.keys(newErrors).length) {
      setErrors(newErrors);
      return;
    }

    try {
      const response: RegisterResponse = await authServices.register(password, email);
      if (response.ok) {
        navigate("/register/verify", { state: { email, password } });
      }
      setErrors({ general: "Registration Failed Plese Try Again Later" });
    } catch (err) {
      console.error(err);
    }
  };

  const handleOnAgreeChange = () => {
    setAgree(prev => !prev)
  }

  const handleBackClick = () => {
    navigate("/")
  }

  return (
    <BackgroundGradient>
      <FullWidthLayout fullWidthNav={<OnBoardingTopNav onBackClicked={handleBackClick} />}>
        <HeadingText className={styles["title"]}>Create your Account</HeadingText>
        <form className={styles["auth-form"]} onSubmit={handleSubmit}>
          <div className={styles["input-fields"]}>
            <TextInput
              type="email"
              placeholder="Email"
              value={email}
              onChange={e => setEmail((e.target as HTMLInputElement).value)} />
            {errors.email && <span className={styles["error"]}>{errors.email}</span>}
            <TextInput
              type="password"
              placeholder="Password"
              value={password}
              onChange={e => setPassword((e.target as HTMLInputElement).value)}
            />
            {errors.password && <span className={styles["error"]}>{errors.password}</span>}
          </div>
          <CheckBox className={styles["check-box"]} checked={agree} onChange={handleOnAgreeChange}>
            NSFW (Not Safe For Work) <QuestionMarkCircleIcon />
          </CheckBox>
          {errors.general && <span className={styles["error"]}>{errors.general}</span>}
          <div className={styles["user-action-section"]}>
            <div className={styles["auth-buttons"]}>
              <ButtonRow>
                <CircularIconButton className={styles["btn-back"]} onClick={() => navigate("/")} text="Back" variant="tertiary" />
                <CircularIconButton type="submit" className={styles["btn-primary"]} text="Continue" />
              </ButtonRow>
            </div>
            <p className={styles["auth-footer"]}>
              Already have an account?{" "}
              <span onClick={() => navigate("/login")}>Sign in</span>
            </p>
          </div>
        </form>
      </FullWidthLayout>
    </BackgroundGradient >
  );
}
