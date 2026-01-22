import PaymentResult from "@/ui/components/payment/PaymentResult";
import styles from "./PaymentCheck.module.css"

export default function PaymentCheck() {

  return (
    <div className={styles.container}>

      <PaymentResult isSuccessful={false} />
    </div>
  )
}