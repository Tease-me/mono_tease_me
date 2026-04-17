import EmailVerificationWaiting from "@/ui/screens/register/components/EmailVerificationWaiting";
import styles from "./VipVerifyEmailStep.module.css";

type VipVerifyEmailStepProps = {
  email: string;
  onVerified: () => void;
};

export default function VipVerifyEmailStep({
  email,
  onVerified,
}: VipVerifyEmailStepProps) {
  return (
    <section className={styles.panel}>
      <EmailVerificationWaiting
        email={email}
        onVerified={onVerified}
        className={styles.card}
      />
    </section>
  );
}
