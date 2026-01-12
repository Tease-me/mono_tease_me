import { ForgotPasswordResponse, RegisterResponse } from "@/api/models/auth";
import NormalButton from "@/ui/components/inputs/buttons/NormalButton";
import PrimaryButton from "@/ui/components/inputs/buttons/PrimaryButton";
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";

import { apiClient } from "@/api/apis";
import { AuthServicesPreInfluencer } from "@/api/services/AuthServicesPreInfluencer";
import ResendEmailModal from "@/ui/screens/landing-page/components/ResendEmailModal";
import SvgPack from "@/utils/SvgPack";
import "./ProfileSurvey.css";

const PreInfluencerAPI = AuthServicesPreInfluencer(apiClient);

const ProfileSurvey: React.FC = () => {
  const navigate = useNavigate();

  const [name, setName] = useState("");
  const [location, setLocation] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [showResendDialog, setShowResendDialog] = useState(false);
  const [resendEmail, setResendEmail] = useState("");
  const [resendError, setResendError] = useState("");
  const [resendSuccess, setResendSuccess] = useState("");

  const [errors, setErrors] = useState<{
    name?: string;
    location?: string;
    username?: string;
    email?: string;
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

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    const newErrors: {
      name?: string;
      location?: string;
      username?: string;
      email?: string;
      general?: string;
    } = {};

    // Validation
    if (!name.trim()) newErrors.name = "Full name is required";
    if (!location.trim()) newErrors.location = "Location is required";
    if (!username.trim()) newErrors.username = "Username is required";
    if (!email.trim()) newErrors.email = "Email is required";

    if (Object.keys(newErrors).length) {
      setErrors(newErrors);
      return;
    }

    const tempPassword = generateTempPassword(6);

    try {
      const response: RegisterResponse = await PreInfluencerAPI.register({
        full_name: name.trim(),
        location: location.trim(),
        username: username.trim(),
        email: email.trim().toLowerCase(),
        password: tempPassword,
      });

      if (response.ok) {
        navigate("/thank-you");
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
    }
  };

  const handleResendEmail = async () => {
    setResendError("");
    setResendSuccess("");
    const trimmedEmail = resendEmail.trim().toLowerCase();
    if (!trimmedEmail) {
      setResendError("Email is required to resend");
      return;
    }

    try {
      const response: ForgotPasswordResponse =
        await PreInfluencerAPI.forgotPassword(trimmedEmail);

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
          <p className="ps-subtitle">Tell us about yourself</p>

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
              placeholder="@yourusername"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
          </div>

          {/* Email */}
          <div className="ps-field">
            <label className="ps-label">
              Email <span className="ps-required">*</span>
            </label>
            {errors.email && <span className="ps-error">{errors.email}</span>}
            <input
              className="ps-input"
              placeholder="Your email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          {/* Next */}
          <div className="tm-survey-button-container">
            <PrimaryButton
              onClick={handleSubmit}
              text="Next"
              rightIcon={<SvgPack.ArrowRight />}
            />
          </div>
          <div className="ps-secondary-action">
            <button
              className="ps-secondary-link"
              type="button"
              onClick={() => {
                setResendEmail(email);
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
