import { apiClient } from "@/api/apis";
import { RegisterResponse } from "@/api/models/auth";
import { AuthServices } from "@/api/services/AuthServices";


import { AuthContext } from "@/context/AuthContext";
import NormalButton from "@/ui/components/inputs/buttons/NormalButton";
import PrimaryButton from "@/ui/components/inputs/buttons/PrimaryButton";
import CheckBox from "@/ui/components/inputs/check-boxes/CheckBox";
import TextInput from "@/ui/components/inputs/text-inputs/TextInput";
import OnBoardingTopNav from "@/ui/components/nav/OnBoardingTopNav";
import HeadingText from "@/ui/components/typography/HeadingText";
import ButtonRow from "@/ui/templates/ButtonRow";
import FullWidthLayout from "@/ui/templates/FullWidthLayout";
import React, { useContext, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import BackgroundGradient from "../../templates/BackgroundGradient";
import styles from "./RegisterScreen.module.css";
import { InfluencerRepo } from "@/data/repositories/InfluencerRepo";
import { Paths } from "@/routes/path";
import logger from "@/utils/logger";
import clsx from "clsx";
import { validationRules } from "@/utils/validationRules";
import { validateFields } from "@/utils/validations";
import SvgPack from "@/utils/SvgPack";

export default function RegisterScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [agree, setAgree] = useState(false);

  const [errors, setErrors] = useState<{
    email?: string;
    password?: string;
    confirmPassword?: string;
    general?: string;
  }>({});
  const authServices = AuthServices(apiClient);
  const influencerRepo = InfluencerRepo();

  const { isSignedIn } = useContext(AuthContext);

  const navigate = useNavigate();
  const { username } = useParams<{ username: string }>();

  if (isSignedIn) navigate(Paths.home);

  useEffect(() => {
    (async () => {
      if (username) {
        try {
          const res = await influencerRepo.getInfluencer(username)
          localStorage.setItem("influencer_referral_id", res.id);
        } catch (e) {
          logger.debug(e)
          navigate(Paths.root)
        }
      }
    })();
  }, [username])

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    const fieldErrors = validateFields(
      { email, password, confirmPassword },
      {
        email: validationRules.email,
        password: validationRules.password,
        confirmPassword: validationRules.password,
      },
    );

    const newErrors: {
      email?: string;
      password?: string;
      confirmPassword?: string;
      general?: string;
    } = { ...fieldErrors };

    if (password && confirmPassword && password !== confirmPassword) {
      newErrors.confirmPassword = "Passwords do not match";
    }
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
        navigate(Paths.registerVerify, { state: { email, password, influencerId: username } });
      }
      setErrors({ general: "Registration Failed. Please Try Again Later" });
    } catch (err) {
      console.error(err);
    }
  };

  const validateField = (field: "email" | "password" | "confirmPassword", value: string) => {
    let error: string | undefined;
    if (field === "email") error = validationRules.email(value);
    if (field === "password") error = validationRules.password(value);
    if (field === "confirmPassword") {
      error = validationRules.password(value);
      if (!error && password && value && password !== value) {
        error = "Passwords do not match";
      }
    }
    setErrors((prev) => ({ ...prev, [field]: error }));
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
            <div className={clsx(styles["input-field"], styles["email-field"])}>
              <TextInput
                leftIcon={<SvgPack.Message />}
                type="email"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail((e.target as HTMLInputElement).value)}
                onBlur={() => validateField("email", email)}
                autoComplete="email"
              />
              {errors.email && (
                <span className={styles["error"]}>{errors.email}</span>
              )}
            </div>
            <div className={styles["input-field"]}>
              <TextInput
                leftIcon={<SvgPack.Lock />}
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) =>
                  setPassword((e.target as HTMLInputElement).value)
                }
                onBlur={() => validateField("password", password)}
                autoComplete="new-password"
              />
              {errors.password && (
                <span className={styles["error"]}>{errors.password}</span>
              )}
            </div>
            <div className={styles["input-field"]}>
              <TextInput
                leftIcon={<SvgPack.Lock />}
                type="password"
                placeholder="Confirm Password"
                value={confirmPassword}
                onChange={(e) =>
                  setConfirmPassword((e.target as HTMLInputElement).value)
                }
                onBlur={() => validateField("confirmPassword", confirmPassword)}
                autoComplete="new-password"
              />
              {errors.confirmPassword && (
                <span className={styles["error"]}>{errors.confirmPassword}</span>
              )}
            </div>
          </div>
          <CheckBox
            className={styles["check-box"]}
            checked={agree}
            onChange={handleOnAgreeChange}
          >
            I am over 18
          </CheckBox>
          {errors.general && (
            <span className={styles["error"]}>{errors.general}</span>
          )}
          <div className={styles["user-action-section"]}>
            <div className={styles["auth-buttons"]}>
              <ButtonRow>
                <NormalButton
                  className={styles["btn-back"]}
                  onClick={() => navigate(Paths.root)}
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
              <span onClick={() => navigate(Paths.login)}>Sign in</span>
            </p>
          </div>
        </form>
      </FullWidthLayout>
    </BackgroundGradient>
  );
}
