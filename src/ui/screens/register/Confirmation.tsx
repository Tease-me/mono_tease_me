import React, { useContext, useEffect, useMemo, useState } from "react";
import styles from "./Confirmation.module.css";
import BackgroundGradient from "@/ui/templates/BackgroundGradient";
import CenteredLayout from "@/ui/templates/CenteredLayout";
import TeaseMeLogo from "@/ui/components/logos/TeaseMeLogo";
import { useLocation, useNavigate } from "react-router-dom";
import { Endpoints } from "@/api/urls";
import { AuthContext } from "@/context/AuthContext";
import LoadingSpinner from "@/ui/components/loading/LoadingSpinner";
import OnBoardingTopNav from "@/ui/components/nav/OnBoardingTopNav";
import NormalButton from "@/ui/components/inputs/buttons/NormalButton";
import SvgPack from "@/utils/SvgPack";
import { FollowServices } from "@/api/services/FollowServices";
import { apiClient } from "@/api/apis";
import { storage } from "@/utils/storage";
import { LocalStorageKeys } from "@/constants/localStorageKeys";
import { Paths } from "@/routes/path";

interface ConfirmationProps { }

const Confirmation: React.FC<ConfirmationProps> = () => {
  const { isSignedIn, login } = useContext(AuthContext);
  const [isLoading, setIsLoading] = useState(true);
  const [isResending, setIsResending] = useState(false);
  const [resendMessage, setResendMessage] = useState<string | null>(null);
  const { state } = useLocation();
  const [email, setEmail] = useState("");

  const navigate = useNavigate();
  const followServices = useMemo(() => FollowServices(apiClient), []);

  useEffect(() => {
    if (isSignedIn) {
      navigate(Paths.home);
      return;
    }
    const registrationState = state as {
      email?: string;
      password?: string;
      influencerId?: string;
    } | null;
    if (!registrationState?.email || !registrationState?.password) {
      navigate(Paths.registerPlain);
      return;
    }
    const { email, password, influencerId: referralId } = registrationState;
    const savedInfluencerId =
      referralId ??
      storage.get(LocalStorageKeys.InfluencerReferralId) ??
      undefined;
    setEmail(email);
    const ws = new WebSocket(
      `${Endpoints.ws.notifications}?email=${encodeURIComponent(email)}`,
    );
    ws.onmessage = async (event) => {
      const data = JSON.parse(event.data);
      if (data.type === "email_verified") {
        setIsLoading(false);
        const loggedIn = await login(email, password);
        if (loggedIn && savedInfluencerId) {
          try {
            await followServices.follow(savedInfluencerId);
          } catch (err) {
            console.error(
              "Failed to follow influencer after verification",
              err,
            );
          }
        }
        navigate(Paths.home);
        ws.close();
      }
    };
    return () => ws.close();
  }, [isSignedIn, state, navigate, login, followServices]);

  const handleResend = async () => {
    if (!email || isResending) return;
    setIsResending(true);
    setResendMessage(null);
    try {
      const { data } = await apiClient.post(
        `${Endpoints.auth.resendVerificationEmail}?email=${encodeURIComponent(email)}`
      );
      setResendMessage(data.message ?? "A new verification email has been sent!");
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      if (typeof detail === "string") {
        setResendMessage(detail);
      } else {
        setResendMessage("Failed to resend. Please try again later.");
      }
    } finally {
      setIsResending(false);
    }
  };

  return (
    <BackgroundGradient>
      <OnBoardingTopNav />
      <CenteredLayout>
        <div className={styles.container}>
          <TeaseMeLogo size="xlarge" />
          <div className={styles["title"]}>Verify Your Email</div>
          <p className={styles.description}>
            We've sent a verification email to: <strong>{email}</strong>.<br />
            Please check your inbox and confirm your email address.
            <br />
            The verification link will expire in 24 hours.
          </p>
          <div className="mail-apps">
            <SvgPack.Mail.Outlook preserveAspectRatio="xMidYMid meet" />
            <SvgPack.Mail.Gmail preserveAspectRatio="xMidYMid meet" />
            <SvgPack.Mail.Mail preserveAspectRatio="xMidYMid meet" />
            <SvgPack.Mail.Yahoo preserveAspectRatio="xMidYMid meet" />
          </div>
          {isLoading && (
            <div className={styles.loading}>
              <p className={styles.description}>
                Waiting for you to verify your email.
              </p>
              <LoadingSpinner size="small" />
            </div>
          )}
          {resendMessage && (
            <p className={styles.description} style={{ marginTop: 8 }}>
              {resendMessage}
            </p>
          )}
          <div className={styles["buttons-container"]}>
            <NormalButton
              text={isResending ? "Sending..." : "Resend Verification"}
              onClick={handleResend}
            />
          </div>
        </div>
      </CenteredLayout>
    </BackgroundGradient>
  );
};

export default Confirmation;
