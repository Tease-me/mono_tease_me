import React, { useEffect, useContext, useState, useCallback, Suspense } from "react";
import { useNavigate, useLocation } from "react-router-dom";
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
import { validationRules } from "@/utils/validationRules";
import { validateFields } from "@/utils/validations";
import { Paths } from "@/routes/path";
import DisclaimerModal from "@/ui/components/modals/DisclaimerModal";
import { storage } from "@/utils/storage";
import { LocalStorageKeys } from "@/constants/localStorageKeys";

type LoginErrors = {
  email?: string;
  password?: string;
  general?: string;
};

export default function LoginScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [agree, setAgree] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const [showDisclaimer, setShowDisclaimer] = useState<boolean>(() => {
    const storedId = localStorage.getItem(LocalStorageKeys.DisclaimerSeen);
    return storedId === "true" ? false : true;
  });

  const [errors, setErrors] = useState<LoginErrors>({});

  const { login, isSignedIn, authErrors } = useContext(AuthContext);

  const navigate = useNavigate();
  const location = useLocation();
  const fromPath = (location.state as { from?: string })?.from;

  useEffect(() => { if (isSignedIn) navigate(Paths.home); }, [isSignedIn, navigate]);

  useEffect(() => {
    if (authErrors) {
      const error = authErrors.data?.error;
      let errorMessage = 'Login failed. Please try again.';

      if (typeof error === 'string') {
        errorMessage = error;
      } else if (error && typeof error === 'object') {
        const errorObj = error as Record<string, unknown>;
        if (typeof errorObj.error === 'string') {
          errorMessage = errorObj.error;
        } else if (typeof errorObj.message === 'string') {
          errorMessage = errorObj.message;
        } else {
          errorMessage = JSON.stringify(error);
        }
      }

      setErrors(prev => ({ ...prev, general: errorMessage }));
    }
  }, [authErrors]);

  const validate = useCallback((): LoginErrors => {
    return validateFields(
      { email, password },
      {
        email: validationRules.email,
        password: (v) => v ? undefined : "Password is required",
      }
    );
  }, [email, password]);

  const validateEmail = useCallback((value: string): string | undefined => {
    return validationRules.email(value);
  }, []);

  const validatePassword = useCallback((value: string): string | undefined => {
    return value ? undefined : "Password is required";
  }, []);

  const [touched, setTouched] = useState({ email: false, password: false });

  const handleEmailChange = useCallback((value: string) => {
    setEmail(value);
    setErrors((prev) => {
      if (!touched.email) {
        return { ...prev, general: undefined };
      }
      return { ...prev, email: validateEmail(value), general: undefined };
    });
  }, [touched.email, validateEmail]);

  const handlePasswordChange = useCallback((value: string) => {
    setPassword(value);
    setErrors((prev) => {
      if (!touched.password) {
        return { ...prev, general: undefined };
      }
      return { ...prev, password: validatePassword(value), general: undefined };
    });
  }, [touched.password, validatePassword]);
  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (isLoggingIn) return;

    const nextErrors = validate();
    if (Object.keys(nextErrors).length) {
      setErrors(nextErrors);
      setTouched({ email: true, password: true });
      return false;
    }

    setIsLoggingIn(true);
    try {
      await login(email, password);
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleEmailBlur = useCallback(() => {
    setTouched((prev) => ({ ...prev, email: true }));
    setErrors((prev) => ({ ...prev, email: validateEmail(email), general: undefined }));
  }, [email, validateEmail]);

  const handlePasswordBlur = useCallback(() => {
    setTouched((prev) => ({ ...prev, password: true }));
    setErrors((prev) => ({ ...prev, password: validatePassword(password), general: undefined }));
  }, [password, validatePassword]);

  const handleContinueClicked = () => {
    handleSubmit();
  }
  const handleOnAgreeChange = () => {
    setAgree(prev => !prev)
  }

  const handleBackClick = () => {
    navigate(fromPath ?? Paths.root);
  }

  return (
    <BackgroundGradient>
      <DisclaimerModal
        isOpen={showDisclaimer}
        onClose={() => setShowDisclaimer(false)}
        onEnter={() => {
          storage.setBoolean(LocalStorageKeys.DisclaimerSeen, true);
          setShowDisclaimer(false);
        }}
        onExit={() => {
          navigate(Paths.underage)
        }}
      />
      <FullWidthLayout fullWidthNav={<OnBoardingTopNav onBackClicked={fromPath ? handleBackClick : undefined} />}>
        <HeadingText className={styles["title"]}>Login to your Account</HeadingText>
        <form className={styles["auth-form"]} onSubmit={handleSubmit}>
          <div className={styles["input-fields"]}>
            <div className={styles["input-field"]}>
              <TextInput
                leftIcon={<SvgPack.Message />}
                onBlur={handleEmailBlur}
                type="email"
                placeholder="Email"
                value={email}
                onChange={e => handleEmailChange((e.target as HTMLInputElement).value)} />
              <span className={styles["error"]}>{errors.email}</span>
            </div>
            <div className={styles["input-field"]}>
              <TextInput
                leftIcon={<SvgPack.Lock />}
                rightIcon={
                  <button
                    type="button"
                    className={styles["eye-button"]}
                    onClick={() => setShowPassword((v) => !v)}
                    tabIndex={-1}
                  >
                    <Suspense fallback={null}>
                      {showPassword ? <SvgPack.EyeOff /> : <SvgPack.Eye />}
                    </Suspense>
                  </button>
                }
                type={showPassword ? "text" : "password"}
                placeholder="Password"
                onBlur={handlePasswordBlur}
                value={password}
                onChange={e => handlePasswordChange((e.target as HTMLInputElement).value)}
              />
              <span className={styles["error"]}>{errors.password}</span>
            </div>

          </div>
          <CheckBox className={styles["check-box"]} checked={agree} onChange={handleOnAgreeChange}>
            Remember Me
          </CheckBox>
          {errors.general && (
            <ValidationPill variant="error" className={styles["errorPill"]}>
              {errors.general}
            </ValidationPill>
          )}
          <div className={styles["user-action-section"]}>
            <div className={styles["auth-buttons"]}>
              <PrimaryButton
                className={styles["btn-primary"]}
                text={isLoggingIn ? "Signing In..." : "Sign In"}
                onClick={handleContinueClicked}
                disabled={isLoggingIn}
              />
            </div>
            <p className={styles["auth-footer"]}>
              <span onClick={() => navigate(Paths.forgotPassword)}>Forgot your password?</span>
            </p>
          </div>
        </form>
      </FullWidthLayout>
    </BackgroundGradient>
  );
}
