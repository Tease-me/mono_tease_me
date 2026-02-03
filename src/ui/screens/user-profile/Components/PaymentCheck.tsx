import PaymentResult from "@/ui/components/payment/PaymentResult";
import styles from "./PaymentCheck.module.css"
import clsx from "clsx";

export default function PaymentCheck() {

  return (
    <div className={clsx("u-sidebar-full", styles.container)}>

      <PaymentResult isSuccessful={false} />
    </div>
  )
}