import { apiClient } from "@/api/apis";
import { RegisterResponse } from "@/api/models/auth";
import { AuthServices } from "@/api/services/AuthServices";
import QuestionMarkCircleIcon from "@/assets/svg/QuestionMark.svg?react";
import { AuthContext } from "@/context/AuthContext";
import NormalButton from "@/ui/components/inputs/buttons/NormalButton";
import PrimaryButton from "@/ui/components/inputs/buttons/PrimaryButton";
import CheckBox from "@/ui/components/inputs/check-boxes/CheckBox";
import TextInput from "@/ui/components/inputs/text-inputs/TextInput";
import OnBoardingTopNav from "@/ui/components/nav/OnBoardingTopNav";
import HeadingText from "@/ui/components/typography/HeadingText";
import ButtonRow from "@/ui/templates/ButtonRow";
import FullWidthLayout from "@/ui/templates/FullWidthLayout";
import React, { useContext, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import BackgroundGradient from "../../templates/BackgroundGradient";
import styles from "./RegisterScreen.module.css";
export default function RegisterScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [agree, setAgree] = useState(false);

  const [errors, setErrors] = useState<{
    email?: string;
    password?: string;
    general?: string;
  }>({});
  const authServices = AuthServices(apiClient);
  const { isSignedIn } = useContext(AuthContext);

  const navigate = useNavigate();
  const { username } = useParams<{ username: string }>();

  if (isSignedIn) navigate("/home");

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    const newErrors: { email?: string; password?: string; general?: string } =
      {};
    if (!email.trim()) newErrors.email = "Email is required";
    if (!password) newErrors.password = "Password is required";
    if (!agree) newErrors.general = "Please Agree to NSFW";

    if (Object.keys(newErrors).length) {
      setErrors(newErrors);
      return;
    }

    try {
      const response: RegisterResponse = await authServices.register(
        password,
        email.toLowerCase(),
        username || ""
      );
      if (response.ok) {
        navigate("/register/verify", { state: { email, password, influencerId: username } });
      }
      setErrors({ general: "Registration Failed Plese Try Again Later" });
    } catch (err) {
      console.error(err);
    }
  };

  const handleOnAgreeChange = () => {
    setAgree((prev) => !prev);
  };

  const handleBackClick = () => {
    navigate("/");
  };
  const handleContinueClicked = () => {
    handleSubmit();
  };
  return (
    <BackgroundGradient>
      <FullWidthLayout
        fullWidthNav={<OnBoardingTopNav onBackClicked={handleBackClick} />}
      >
        <HeadingText className={styles["title"]}>
          Create your Account
        </HeadingText>
        <form className={styles["auth-form"]} onSubmit={handleSubmit}>
          <div className={styles["input-fields"]}>
            <div className={styles["input-field"]}>
              <TextInput
                type="email"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail((e.target as HTMLInputElement).value)}
              />
              {errors.email && (
                <span className={styles["error"]}>{errors.email}</span>
              )}
            </div>
            <div className={styles["input-field"]}>
              <TextInput
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) =>
                  setPassword((e.target as HTMLInputElement).value)
                }
              />
              {errors.password && (
                <span className={styles["error"]}>{errors.password}</span>
              )}
            </div>
          </div>
          <CheckBox
            className={styles["check-box"]}
            checked={agree}
            onChange={handleOnAgreeChange}
          >
            NSFW (Not Safe For Work) <QuestionMarkCircleIcon />
          </CheckBox>
          {errors.general && (
            <span className={styles["error"]}>{errors.general}</span>
          )}
          <div className={styles["user-action-section"]}>
            <div className={styles["auth-buttons"]}>
              <ButtonRow>
                <NormalButton
                  className={styles["btn-back"]}
                  onClick={() => navigate("/")}
                  text="Back"
                  color="black"
                />
                <PrimaryButton
                  className={styles["btn-primary"]}
                  text="Continue"
                  onClick={handleContinueClicked}
                />
              </ButtonRow>
            </div>
            <p className={styles["auth-footer"]}>
              Already have an account?{" "}
              <span onClick={() => navigate("/login")}>Sign in</span>
            </p>
          </div>
        </form>
      </FullWidthLayout>
    </BackgroundGradient>
  );
}
