import EmailVerificationWaiting from "@/ui/screens/register/components/EmailVerificationWaiting";
import styles from "./VipVerifyEmailStep.module.css";

type VipVerifyEmailStepProps = {
  email: string;
  message?: string;
  onVerified: () => void;
};

export default function VipVerifyEmailStep({
  email,
  message,
  onVerified,
}: VipVerifyEmailStepProps) {
  return (
    <section className={styles.panel}>
      <EmailVerificationWaiting
        email={email}
        message={message}
        onVerified={onVerified}
        className={styles.card}
      />
    </section>
  );
}
