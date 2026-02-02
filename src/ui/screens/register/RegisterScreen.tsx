import { apiClient } from "@/api/apis";
import { RegisterResponse } from "@/api/models/auth";
import { AuthServices } from "@/api/services/AuthServices";


import { AuthContext } from "@/context/AuthContext";
import OnBoardingTopNav from "@/ui/components/nav/OnBoardingTopNav";
import HeadingText from "@/ui/components/typography/HeadingText";
import FullWidthLayout from "@/ui/templates/FullWidthLayout";
import React, { useContext, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import BackgroundGradient from "../../templates/BackgroundGradient";
import styles from "./RegisterScreen.module.css";
import { InfluencerRepo } from "@/data/repositories/InfluencerRepo";
import { Paths } from "@/routes/path";
import logger from "@/utils/logger";
import { validationRules } from "@/utils/validationRules";
import { required, validateFields } from "@/utils/validations";
import RegisterStepForm from "./RegisterStepForm";
import UpdateProfileStepForm from "./UpdateProfileStepForm";

export default function RegisterScreen() {
  const [step, setStep] = useState<1 | 2>(1);
  const [account, setAccount] = useState({
    email: "",
    password: "",
    confirmPassword: "",
    agree: false,
  });
  const [profile, setProfile] = useState({
    fullName: "",
    gender: "" as "male" | "female" | "",
    dateOfBirth: "",
  });

  const [accountErrors, setAccountErrors] = useState<{
    email?: string;
    password?: string;
    confirmPassword?: string;
    general?: string;
  }>({});
  const [profileErrors, setProfileErrors] = useState<{
    fullName?: string;
    gender?: string;
    dateOfBirth?: string;
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

  const validateStepOne = () => {
    const fieldErrors = validateFields(
      {
        email: account.email,
        password: account.password,
        confirmPassword: account.confirmPassword,
      },
      {
        email: validationRules.email,
        password: validationRules.password,
        confirmPassword: validationRules.password,
      },
    );

    const nextErrors: {
      email?: string;
      password?: string;
      confirmPassword?: string;
      general?: string;
    } = { ...fieldErrors };

    if (
      account.password &&
      account.confirmPassword &&
      account.password !== account.confirmPassword
    ) {
      nextErrors.confirmPassword = "Passwords do not match";
    }
    if (!account.agree) nextErrors.general = "Please Agree to NSFW";

    return nextErrors;
  };

  const validateStepTwo = () => {
    const fieldErrors = validateFields(
      {
        fullName: profile.fullName,
        gender: profile.gender,
        dateOfBirth: profile.dateOfBirth,
      },
      {
        fullName: required("Full name"),
        gender: required("Gender"),
        dateOfBirth: required("Date of birth"),
      },
    );

    return {
      fullName: fieldErrors.fullName,
      gender: fieldErrors.gender,
      dateOfBirth: fieldErrors.dateOfBirth,
    };
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    if (step === 1) {
      const newErrors = validateStepOne();
      if (Object.keys(newErrors).length) {
        setAccountErrors(newErrors);
        return;
      }
      setAccountErrors({});
      setStep(2);
      return;
    }

    const stepOneErrors = validateStepOne();
    const stepTwoErrors = validateStepTwo();
    const hasErrors =
      Object.keys(stepOneErrors).length > 0 ||
      Object.keys(stepTwoErrors).length > 0;
    if (hasErrors) {
      setAccountErrors(stepOneErrors);
      setProfileErrors(stepTwoErrors);
      return;
    }

    try {
      const influencerId =
        localStorage.getItem("influencer_referral_id") || username || "";
      const response: RegisterResponse = await authServices.register(
        account.password,
        account.email.toLowerCase(),
        influencerId,
        profile.fullName,
        profile.gender,
        profile.dateOfBirth
      );
      if (response.ok) {
        navigate(Paths.registerVerify, {
          state: { email: account.email, password: account.password, influencerId },
        });
      }
      setAccountErrors({ general: "Registration Failed. Please Try Again Later" });
    } catch (err) {
      console.error(err);
    }
  };

  const validateField = (
    field:
      | "email"
      | "password"
      | "confirmPassword"
      | "fullName"
      | "gender"
      | "dateOfBirth",
    value: string,
  ) => {
    let error: string | undefined;
    if (field === "email") error = validationRules.email(value);
    if (field === "password") error = validationRules.password(value);
    if (field === "confirmPassword") {
      error = validationRules.password(value);
      if (!error && account.password && value && account.password !== value) {
        error = "Passwords do not match";
      }
    }
    if (field === "fullName") error = required("Full name")(value);
    if (field === "gender") error = required("Gender")(value);
    if (field === "dateOfBirth") error = required("Date of birth")(value);
    if (field === "email" || field === "password" || field === "confirmPassword") {
      setAccountErrors((prev) => ({ ...prev, [field]: error }));
      return;
    }
    setProfileErrors((prev) => ({ ...prev, [field]: error }));
  };
  const handleEditProfileMediaClicked = () => {
    console.warn("Edit Clicked")
  };
  const handleBackClick = () => {
    if (step === 2) {
      setStep(1);
      return;
    }
    navigate(Paths.influencerProfile(username || ""));
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
        {step === 1 ? (
          <RegisterStepForm
            values={account}
            errors={accountErrors}
            onChange={(field, value) => {
              setAccount((prev) => ({ ...prev, [field]: value }));
              if (field === "agree") {
                setAccountErrors((prev) => ({ ...prev, general: undefined }));
              }
            }}
            onBlur={(field) => validateField(field, String(account[field]))}
            onContinue={handleContinueClicked}
            onBack={() => navigate(Paths.root)}
            onSignIn={() => navigate(Paths.login)}
          />
        ) : (
          <UpdateProfileStepForm
            values={profile}
            errors={profileErrors}
            onChange={(field, value) => {
              setProfile((prev) => ({ ...prev, [field]: value }));
            }}
            onGenderSelect={(value) => {
              setProfile((prev) => ({ ...prev, gender: value }));
              validateField("gender", value);
            }}
            onBlur={(field) => validateField(field, profile[field])}
            onBack={() => setStep(1)}
            onSubmit={handleContinueClicked}
            handleEditProfileMediaClicked={handleEditProfileMediaClicked}
          />
        )}
      </FullWidthLayout>
    </BackgroundGradient>
  );
}
