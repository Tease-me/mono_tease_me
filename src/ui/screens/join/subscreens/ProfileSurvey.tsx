import { RegisterResponse, ResendSurveyResponse } from "@/api/models/auth";
import NormalButton from "@/ui/components/inputs/buttons/NormalButton";
import PrimaryButton from "@/ui/components/inputs/buttons/PrimaryButton";
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";

import { apiClient } from "@/api/apis";
import { AuthServicesPreInfluencer } from "@/api/services/AuthServicesPreInfluencer";
import { LocalStorageKeys } from "@/constants/localStorageKeys";
import { Paths } from "@/routes/path";
import ResendEmailModal from "@/ui/screens/join/components/ResendEmailModal";
import { THANK_YOU_VARIANTS } from "@/ui/screens/join/subscreens/thankYouVariants";
import { storage } from "@/utils/storage";
import SvgPack from "@/utils/SvgPack";
import { validationRules } from "@/utils/validationRules";
import "./ProfileSurvey.css";

const PreInfluencerAPI = AuthServicesPreInfluencer(apiClient);

type ProfileSurveyProps = {
  initialEmail?: string;
};

const ProfileSurvey: React.FC<ProfileSurveyProps> = ({ initialEmail = "" }) => {
  const navigate = useNavigate();

  const [name, setName] = useState("");
  const [location, setLocation] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState(() => {
    const attribution = storage.getObject<{ inviteeEmail?: string }>(LocalStorageKeys.JoinAttribution);
    return initialEmail || attribution?.inviteeEmail || "";
  });
  const [mainLanguage, setMainLanguage] = useState("");
  const [secondaryLanguage, setSecondaryLanguage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showResendDialog, setShowResendDialog] = useState(false);
  const [resendEmail, setResendEmail] = useState("");
  const [resendError, setResendError] = useState("");
  const [resendSuccess, setResendSuccess] = useState("");

  const [errors, setErrors] = useState<{
    name?: string;
    location?: string;
    username?: string;
    email?: string;
    mainLanguage?: string;
    general?: string;
  }>({});

  const handleBack = () => {
    navigate(-1);
  };

  const generateTempPassword = (length: number = 6): string => {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
    let pwd = "";
    for (let i = 0; i < length; i++) {
      pwd += chars[Math.floor(Math.random() * chars.length)];
    }
    return pwd;
  };

  const clearJoinAttribution = () => {
    storage.remove(LocalStorageKeys.JoinAttribution);
    storage.remove(LocalStorageKeys.ParentRefId);
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    const newErrors: {
      name?: string;
      location?: string;
      username?: string;
      email?: string;
      mainLanguage?: string;
      general?: string;
    } = {};

    // Validation
    if (!name.trim()) newErrors.name = "Full name is required";
    if (!location.trim()) newErrors.location = "Location is required";
    if (!username.trim()) {
      newErrors.username = "Username is required";
    } else if (username.length < 3) {
      newErrors.username = "Username must be at least 3 characters";
    } else if (!/^[a-z0-9_.]+$/.test(username)) {
      newErrors.username = "Username can only contain lowercase letters, numbers, underscores and dots";
    }
    const normalizedEmail = email.trim().toLowerCase();
    const emailError = validationRules.email(normalizedEmail);
    if (emailError) newErrors.email = emailError;
    if (!mainLanguage.trim()) {
      newErrors.mainLanguage = "Main language is required";
    }

    if (Object.keys(newErrors).length) {
      setErrors(newErrors);
      return;
    }

    const tempPassword = generateTempPassword(6);

    setIsSubmitting(true);
    try {
      const response: RegisterResponse = await PreInfluencerAPI.register({
        full_name: name.trim(),
        location: location.trim(),
        username: username.trim(),
        email: normalizedEmail,
        password: tempPassword,
        survey_answers: {
          q4_country: location.trim(),
          q5_main_language: mainLanguage.trim(),
          ...(secondaryLanguage.trim()
            ? { q6_secondary_language: secondaryLanguage.trim() }
            : {}),
        },
      });

      if (response.ok) {
        const onboardingUrl = response.onboarding_url?.trim();
        clearJoinAttribution();

        if (onboardingUrl) {
          const nextUrl = new URL(
            onboardingUrl.startsWith("/") ? onboardingUrl : `/${onboardingUrl}`,
            window.location.origin,
          );
          nextUrl.searchParams.set("start_step", "picture");
          navigate(`${nextUrl.pathname}${nextUrl.search}`);
          return;
        }

        if (response.token && response.temp_password) {
          const params = new URLSearchParams({
            token: response.token,
            temp_password: response.temp_password,
            start_step: "picture",
          });
          navigate(`${Paths.joinOnboarding}?${params.toString()}`);
          return;
        }

        navigate(`${Paths.thankYou}?variant=${THANK_YOU_VARIANTS.received}`);
        return;
      }

      setErrors({
        general:
          (response as any).message ||
          "Registration failed, please try again later",
      });
    } catch (err) {
      console.error(err);
      setErrors({
        general: "Unexpected error, please try again later",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResendEmail = async () => {
    setResendError("");
    setResendSuccess("");
    const identifier = resendEmail.trim();
    if (!identifier) {
      setResendError("Email or username is required to resend");
      return;
    }

    try {
      const response: ResendSurveyResponse =
        await PreInfluencerAPI.resendSurvey(identifier);

      if (response.ok) {
        setErrors((prev) => ({ ...prev, general: undefined }));
        setResendSuccess(
          response.message || "We sent a new email. Please check your inbox."
        );
        return;
      }

      setResendError(
        response.message || "Unable to resend email. Please try again later."
      );
    } catch (err) {
      console.error(err);
      setResendError("Unexpected error, please try again later");
    }
  };

  return (
    <div className="ps-screen">
      <div className="ps-frame">
        <div className="ps-card">
          <div className="tm-survey-back-button-container">
            <NormalButton
              onClick={handleBack}
              text="Back"
              leftIcon={<SvgPack.ArrowLeft />}
            />
          </div>

          <h2 className="ps-title">Profile Survey</h2>
          <p className="ps-subtitle">Complete your basic details</p>

          {errors.general && (
            <div className="ps-error ps-error-general">{errors.general}</div>
          )}

          {/* Full Name */}
          <div className="ps-field">
            <label className="ps-label">
              Full Name <span className="ps-required">*</span>
            </label>
            {errors.name && <span className="ps-error">{errors.name}</span>}
            <input
              className="ps-input"
              placeholder="Your full name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          {/* Location */}
          <div className="ps-field">
            <label className="ps-label">
              Location <span className="ps-required">*</span>
            </label>
            {errors.location && (
              <span className="ps-error">{errors.location}</span>
            )}
            <input
              className="ps-input"
              placeholder="Country or Region"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
            />
          </div>

          {/* Username */}
          <div className="ps-field">
            <label className="ps-label">
              Username <span className="ps-required">*</span>
            </label>
            {errors.username && (
              <span className="ps-error">{errors.username}</span>
            )}
            <input
              className="ps-input"
              placeholder="yourusername"
              value={username}
              onChange={(e) => {
                const sanitized = e.target.value
                  .toLowerCase()
                  .replace(/[^a-z0-9_.]/g, "");
                setUsername(sanitized);
              }}
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
            />
          </div>

          {/* Email */}
          <div className="ps-field">
            <label className="ps-label">
              Email
              <span className="ps-required"> *</span>
            </label>
            {errors.email && <span className="ps-error">{errors.email}</span>}
            <input
              className="ps-input"
              placeholder="Your email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              type="email"
              autoComplete="email"
            />
          </div>

          {/* Main Language */}
          <div className="ps-field">
            <label className="ps-label">
              Main Language <span className="ps-required">*</span>
            </label>
            {errors.mainLanguage && (
              <span className="ps-error">{errors.mainLanguage}</span>
            )}
            <input
              className="ps-input"
              placeholder="Your main language"
              value={mainLanguage}
              onChange={(e) => setMainLanguage(e.target.value)}
            />
          </div>

          {/* Secondary Language */}
          <div className="ps-field">
            <label className="ps-label">Secondary Language</label>
            <input
              className="ps-input"
              placeholder="Optional secondary language"
              value={secondaryLanguage}
              onChange={(e) => setSecondaryLanguage(e.target.value)}
            />
          </div>

          {/* Next */}
          <div className="tm-survey-button-container">
            <PrimaryButton
              onClick={handleSubmit}
              text="Next"
              rightIcon={<SvgPack.ArrowRight />}
              loading={isSubmitting}
            />
          </div>
          <div className="ps-secondary-action">
            <button
              className="ps-secondary-link"
              type="button"
              onClick={() => {
                setResendEmail(email || username);
                setResendError("");
                setResendSuccess("");
                setShowResendDialog(true);
              }}
            >
              Already started? Resend email
            </button>
          </div>
          <div className="spacer-profile"></div>
        </div>
      </div>
      <ResendEmailModal
        isOpen={showResendDialog}
        email={resendEmail}
        error={resendError}
        success={resendSuccess}
        onEmailChange={setResendEmail}
        onClose={() => setShowResendDialog(false)}
        onSubmit={handleResendEmail}
      />
    </div>
  );
};

export default ProfileSurvey;
