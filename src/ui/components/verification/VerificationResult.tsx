import SvgPack from "@/utils/SvgPack";
import styles from "./VerificationResult.module.css";
import IconButton from "@/ui/components/inputs/buttons/IconButton";
import clsx from "clsx";

type VerificationResultProps = {
  isSuccessful: boolean;
  onBack?: () => void;
};

export default function VerificationResult({ isSuccessful, onBack }: VerificationResultProps) {
  const successText = "Your age verification was successful.";
  const failureText =
    "We couldn’t verify your age. Please try again or contact support if this keeps happening.";

  return (
    <div className={clsx("u-sidebar-page", styles.container)}>
      <div className={styles.imageArea}>
        <div className={styles.icon}>
          {isSuccessful ? <SvgPack.PaymentTick /> : <SvgPack.PaymentCross />}
        </div>
      </div>
      <div className={clsx(styles.title, isSuccessful ? styles.success : styles.error)}>
        <h3 className={isSuccessful ? styles.success : styles.error}>
          Verification {isSuccessful ? "Successful" : "Failed"}
        </h3>
      </div>
      <div className={styles.details}>
        <span>{isSuccessful ? successText : failureText}</span>
      </div>
      <div className={clsx("u-sidebar-footer", styles.footer)}>
        <div className={clsx(styles.footerTxt, isSuccessful ? styles.success : styles.error)}>
          {isSuccessful ? "You will be automatically redirected" : "Need help?"}
        </div>
        <div className={styles.footerBtnArea}>
          <IconButton className={styles.btn} color="black" text="Back to Profile" onClick={onBack} />
        </div>
      </div>
    </div>
  );
}
