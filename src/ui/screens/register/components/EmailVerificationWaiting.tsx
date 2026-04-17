import { apiClient } from "@/api/apis";
import { Endpoints, WsEndpoints } from "@/api/urls";
import LoadingSpinner from "@/ui/components/loading/LoadingSpinner";
import NormalButton from "@/ui/components/inputs/buttons/NormalButton";
import { NotificationEvent } from "@/hooks/useNotificationSocket";
import SvgPack from "@/utils/SvgPack";
import logger from "@/utils/logger";
import clsx from "clsx";
import { useEffect, useState } from "react";
import styles from "./EmailVerificationWaiting.module.css";

type EmailVerificationWaitingProps = {
  email: string;
  className?: string;
  onVerified?: () => void;
};

export default function EmailVerificationWaiting({
  email,
  className,
  onVerified,
}: EmailVerificationWaitingProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [isResending, setIsResending] = useState(false);
  const [resendMessage, setResendMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!email) return;

    setIsLoading(true);
    setResendMessage(null);

    const ws = new WebSocket(WsEndpoints.notifications(email));

    ws.onopen = () => {
      logger.info("[EmailVerificationWaiting] notification socket connected");
    };

    ws.onerror = () => {
      logger.error("[EmailVerificationWaiting] notification socket error");
    };

    ws.onclose = (event) => {
      logger.info(
        `[EmailVerificationWaiting] notification socket closed (${event.code})`,
      );
    };

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data) as NotificationEvent;
      if (data.type === "email_verified") {
        setIsLoading(false);
        setResendMessage("Email verified. Return to the app to continue.");
        onVerified?.();
        ws.close();
      }
    };

    return () => ws.close();
  }, [email, onVerified]);

  const handleResend = async () => {
    if (!email || isResending) return;

    setIsResending(true);
    setResendMessage(null);

    try {
      const { data } = await apiClient.post(
        `${Endpoints.auth.resendVerificationEmail}?email=${encodeURIComponent(
          email,
        )}`,
      );
      setResendMessage(data.message ?? "A new verification email has been sent!");
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      setResendMessage(
        typeof detail === "string"
          ? detail
          : "Failed to resend. Please try again later.",
      );
    } finally {
      setIsResending(false);
    }
  };

  return (
    <div className={clsx(styles.container, className)}>
      <div className={styles.title}>Verify Your Email</div>
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
      {resendMessage && <p className={styles.message}>{resendMessage}</p>}
      <div className={styles.buttonsContainer}>
        <NormalButton
          text={isResending ? "Sending..." : "Resend Verification"}
          onClick={handleResend}
          disabled={isResending}
        />
      </div>
    </div>
  );
}
