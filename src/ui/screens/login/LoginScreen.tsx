import React, { useContext, useState } from "react";
import { useNavigate } from "react-router-dom";
import BackgroundGradient from "../../templates/BackgroundGradient";
import styles from "./LoginScreen.module.css";
import CheckBox from "@/ui/components/inputs/check-boxes/CheckBox";
import TextInput from "@/ui/components/inputs/text-inputs/TextInput";
import HeadingText from "@/ui/components/typography/HeadingText";
import { AuthContext } from "@/context/AuthContext";
import OnBoardingTopNav from "@/ui/components/nav/OnBoardingTopNav";
import FullWidthLayout from "@/ui/templates/FullWidthLayout";
import SvgPack from "@/utils/SvgPack";
import PrimaryButton from "@/ui/components/inputs/buttons/PrimaryButton";
import ValidationPill from "@/ui/components/inputs/buttons/ValidationPill";

export default function LoginScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [agree, setAgree] = useState(false);

  const [errors, setErrors] = useState<{ email?: string; password?: string, general?: string }>({});
  const { login, isSignedIn } = useContext(AuthContext);

  const navigate = useNavigate();

  if (isSignedIn) navigate("/home");

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const newErrors: { email?: string; password?: string, general?: string } = {};
    if (!email.trim()) newErrors.email = "Email is required";
    if (!password) newErrors.password = "Password is required";

    if (Object.keys(newErrors).length) {
      setErrors(newErrors);
      return;
    }
    try {
      const success = await login(email, password);
      if (success) {
        navigate("/home");
      }
      setErrors({ general: "Registration Failed. Please check your username or password." });
    }
    catch (err) {
      setErrors({ general: "Registration Failed. Please check your username or password." });
      console.error(err);
    }
  };
  const handleContinueClicked = () => {
    handleSubmit();
  }
  const handleOnAgreeChange = () => {
    setAgree(prev => !prev)
  }

  const handleBackClick = () => {
    navigate("/")
  }

  return (
    <BackgroundGradient>
      <FullWidthLayout fullWidthNav={<OnBoardingTopNav onBackClicked={handleBackClick} />}>
        <HeadingText className={styles["title"]}>Login to your Account</HeadingText>
        <form className={styles["auth-form"]} onSubmit={handleSubmit}>
          <div className={styles["input-fields"]}>
            <div className={styles["input-field"]}>
              <TextInput
                leftIcon={<SvgPack.Message />}
                type="email"
                placeholder="Email"
                value={email}
                onChange={e => setEmail((e.target as HTMLInputElement).value)} />
              {errors.email && <span className={styles["error"]}>{errors.email}</span>}
            </div>
            <div className={styles["input-field"]}>
              <TextInput
                leftIcon={<SvgPack.Lock />}
                type="password"
                placeholder="Password"
                value={password}
                onChange={e => setPassword((e.target as HTMLInputElement).value)}
              />
              {errors.password && <span className={styles["error"]}>{errors.password}</span>}
            </div>
          </div>
          <CheckBox className={styles["check-box"]} checked={agree} onChange={handleOnAgreeChange}>
            Remember Me
          </CheckBox>
          {errors.general && (
            <ValidationPill variant="error" className={styles["error-pill"]}>
              {errors.general}
            </ValidationPill>
          )}
          <div className={styles["user-action-section"]}>
            <div className={styles["auth-buttons"]}>
              <PrimaryButton className={styles["btn-primary"]} text="Sign In" onClick={handleContinueClicked} />
            </div>
            <p className={styles["auth-footer"]}>
              <span onClick={() => navigate("/forgot-password")}>Forgot your password?</span>
            </p>
          </div>
        </form>
      </FullWidthLayout>
    </BackgroundGradient >
  );
}
