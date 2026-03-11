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
import BlockingLoader from "@/ui/components/loading/BlockingLoader";
import { storage } from "@/utils/storage";
import { LocalStorageKeys } from "@/constants/localStorageKeys";

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
    userName: "",
    gender: "male" as "male" | "female",
    dateOfBirth: "",
    profilePhotoFile: null as File | null,
  });

  const [accountErrors, setAccountErrors] = useState<{
    email?: string;
    password?: string;
    confirmPassword?: string;
    general?: string;
  }>({});
  const [profileErrors, setProfileErrors] = useState<{
    fullName?: string;
    userName?: string;
    gender?: string;
    dateOfBirth?: string;
    general?: string;
  }>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
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
          const res = await influencerRepo.getInfluencer(username);
          storage.set(LocalStorageKeys.InfluencerReferralId, res.id);
        } catch (e) {
          logger.debug(e);
          navigate(Paths.root);
        }
      }
    })();
  }, [username]);

  useEffect(() => {
    logger.debug("Register errors updated", {
      accountErrors,
      profileErrors,
    });
  }, [accountErrors, profileErrors]);

  useEffect(() => {
    logger.debug("Register data updated", {
      step,
      account,
      profile,
    });
  }, [step, account, profile]);

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
    if (!account.agree) nextErrors.general = "Confirm that you are over 18";

    return cleanErrors(nextErrors);
  };

  const cleanErrors = <T extends Record<string, string | undefined>>(
    errors: T,
  ) =>
    Object.fromEntries(
      Object.entries(errors).filter(
        ([, value]) => value !== undefined && value !== "",
      ),
    ) as Partial<T>;

  const isAdult = (isoDate: string, minimumAge = 18) => {
    if (!isoDate) return false;
    const dob = new Date(isoDate);
    if (Number.isNaN(dob.getTime())) return false;
    const today = new Date();
    let age = today.getFullYear() - dob.getFullYear();
    const monthDiff = today.getMonth() - dob.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
      age -= 1;
    }
    return age >= minimumAge;
  };

  const validateStepTwo = () => {
    const fieldErrors = validateFields(
      {
        fullName: profile.fullName,
        userName: profile.userName,
        gender: profile.gender,
        dateOfBirth: profile.dateOfBirth,
      },
      {
        fullName: required("Full name"),
        userName: validationRules.username,
        gender: required("Gender"),
        dateOfBirth: required("Date of birth"),
      },
    );

    const nextErrors = {
      fullName: fieldErrors.fullName,
      userName: fieldErrors.userName,
      gender: fieldErrors.gender,
      dateOfBirth: fieldErrors.dateOfBirth,
    };

    if (!nextErrors.dateOfBirth && !isAdult(profile.dateOfBirth)) {
      nextErrors.dateOfBirth = "You must be at least 18 years old";
    }

    return cleanErrors(nextErrors);
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    if (step === 1) {
      const newErrors = validateStepOne();
      if (Object.keys(newErrors).length) {
        setAccountErrors(cleanErrors(newErrors));
        return;
      }
      setAccountErrors({});
      setProfileErrors({});
      setStep(2);
      return;
    }

    const stepOneErrors = validateStepOne();
    const stepTwoErrors = validateStepTwo();
    const hasErrors =
      Object.keys(stepOneErrors).length > 0 ||
      Object.keys(stepTwoErrors).length > 0;
    if (hasErrors) {
      setAccountErrors(cleanErrors(stepOneErrors));
      setProfileErrors(stepTwoErrors);
      return;
    }

    try {
      setIsSubmitting(true);
      const influencerId =
        storage.get(LocalStorageKeys.InfluencerReferralId) || username || "";
      const response: RegisterResponse = await authServices.register(
        account.password,
        account.email.toLowerCase(),
        influencerId,
        profile.fullName,
        profile.gender,
        profile.userName,
        profile.dateOfBirth,
        profile.profilePhotoFile,
      );
      const detailMessage =
        typeof (response as any)?.detail === "string"
          ? (response as any).detail
          : undefined;
      if (detailMessage) {
        setAccountErrors({ general: detailMessage });
        setProfileErrors((prev) => ({ ...prev, general: detailMessage }));
        return;
      }
      if (response.ok) {
        navigate(Paths.registerVerify, {
          state: {
            email: account.email,
            password: account.password,
            influencerId,
          },
        });
        return;
      }
      setAccountErrors({
        general: "Registration Failed. Please Try Again Later",
      });
      setProfileErrors((prev) => ({
        ...prev,
        general: "Registration Failed. Please Try Again Later",
      }));
    } catch (err: any) {
      const detail = err?.detail || err?.response?.data?.detail;
      const message =
        typeof detail === "string" && detail.trim()
          ? detail
          : "Registration Failed. Please Try Again Later";
      setAccountErrors({ general: message });
      setProfileErrors((prev) => ({ ...prev, general: message }));
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const validateField = (
    field:
      | "email"
      | "password"
      | "confirmPassword"
      | "fullName"
      | "userName"
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
    if (field === "userName") error = validationRules.nickName(value);
    if (field === "gender") error = required("Gender")(value);
    if (field === "dateOfBirth") {
      error = required("Date of birth")(value);
      if (!error && !isAdult(value)) {
        error = "You must be at least 18 years old";
      }
    }
    if (
      field === "email" ||
      field === "password" ||
      field === "confirmPassword"
    ) {
      setAccountErrors((prev) => ({ ...prev, [field]: error }));
      return;
    }
    setProfileErrors((prev) => ({ ...prev, [field]: error }));
  };
  const handleEditProfileMediaClicked = () => {
    console.warn("Edit Clicked");
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
        fullWidthNav={
          <OnBoardingTopNav onBackClicked={handleBackClick} />
        }>
        {!isSubmitting && (
          <HeadingText className={styles["title"]}>
            Create your Account
          </HeadingText>
        )}
        {isSubmitting ? (
          <BlockingLoader />
        ) : step === 1 ? (
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
            onBack={handleBackClick}
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
            onProfilePhotoChange={(file) => {
              setProfile((prev) => ({ ...prev, profilePhotoFile: file }));
            }}
          />
        )}
      </FullWidthLayout>
    </BackgroundGradient>
  );
}
