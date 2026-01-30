
import SvgPack from "@/utils/SvgPack"
import styles from "./PaymentResult.module.css"
import IconButton from "../inputs/buttons/IconButton"
import clsx from "clsx"



type PaymentResultProps = {
  isSuccessful: boolean,
  onBack?: () => void;
  onContactSupport?: () => void;
  amount?: number;
  influencerName?: string;
}

export default function PaymentResult({ isSuccessful, onBack, onContactSupport, amount, influencerName }: PaymentResultProps) {
  const hasSuccessContext = Number.isFinite(amount) && Boolean(influencerName);
  const successText = hasSuccessContext
    ? `You have successfully recharged $${amount} towards ${influencerName}'s account.`
    : "Your payment was successful.";
  const failureText = `Please check that you have the required funds and try again. Perhaps try with a different payment method. You have not been charged for this transaction.`;

  return (
    <div className={clsx('u-sidebar-page', styles.container)}>
      <div className={styles.imageArea}>
        {/* <div className={styles.imgBg}>
          <img src={isSuccessful ? PaymentSuccessBg : PaymentFailureBg} />
        </div> */}
        <div className={styles.icon}>
          {isSuccessful ? <SvgPack.PaymentTick /> : <SvgPack.PaymentCross />}
        </div>
      </div>
      <div className={clsx(styles.title, isSuccessful ? styles.success : styles.error)}>
        <h3 className={isSuccessful ? styles.success : styles.error}>Payment {isSuccessful ? "Successful" : "Unsuccessful"}</h3>
      </div>
      <div className={styles.details}>
        {!isSuccessful && <span className={styles.error}>We cannot make this payment.</span>}<br />
        <span>
          {isSuccessful ? successText : failureText}
        </span>
        <br></br>
      </div>
      <div className={clsx('u-sidebar-footer', styles.footer)}>
        <div className={clsx(styles.footerTxt, isSuccessful ? styles.success : styles.error)}>
          {isSuccessful ? 'You will be automatically redirected' : 'Still having errors?'}
        </div>
        <div className={styles.footerBtnArea}>
          {!isSuccessful && <IconButton className={styles.btn} color="pink-glass" text="Contact Support" onClick={onContactSupport} />}
          <IconButton className={styles.btn} color="black" text="Back to Profile" onClick={onBack} />
        </div>
      </div>
    </div>
  )
}
