import { apiClient } from "@/api/apis";
import { BillingServices } from "@/api/services/BillingServices";
import { Paths } from "@/routes/path";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import PaymentResult from "@/ui/components/payment/PaymentResult";
import styles from "./PayPalReturn.module.css";
import LoadingSpinner from "@/ui/components/loading/LoadingSpinner";

const billing = BillingServices(apiClient);

export default function PayPalReturn() {
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [amount, setAmount] = useState<number | undefined>();
  const [influencerName, setInfluencerName] = useState<string | undefined>();
  const navigate = useNavigate();
  const fallbackAmount = useMemo(() => {
    const raw = localStorage.getItem("paypal_topup_amount");
    const parsed = raw ? Number(raw) : NaN;
    return Number.isFinite(parsed) ? parsed : undefined;
  }, []);
  const fallbackInfluencerName = useMemo(() => {
    const raw = localStorage.getItem("paypal_topup_influencer_name");
    return raw?.trim() || undefined;
  }, []);

  useEffect(() => {
    (async () => {
      const params = new URLSearchParams(window.location.search);
      const tokenOrderId = params.get("token");
      const order_id =
        tokenOrderId || localStorage.getItem("paypal_topup_order_id");
      const influencer_id =
        localStorage.getItem("paypal_topup_influencer_id") || "";

      if (!order_id) {
        setStatus("error");
        return;
      }

      try {
        const res = await billing.paypalCapture({ order_id, influencer_id });

        if (res?.ok) {
          localStorage.removeItem("paypal_topup_order_id");
          localStorage.removeItem("paypal_topup_influencer_id");
          localStorage.removeItem("paypal_topup_amount");
          localStorage.removeItem("paypal_topup_influencer_name");
          setStatus("success");
          setTimeout(() => navigate(Paths.home), 2000);
        } else {
          setStatus("error");
        }
      } catch {
        setStatus("error");
      }
    })();
  }, [navigate]);

  useEffect(() => {
    if (fallbackAmount !== undefined) {
      setAmount(fallbackAmount);
    }
    if (fallbackInfluencerName) {
      setInfluencerName(fallbackInfluencerName);
    }
  }, [fallbackAmount, fallbackInfluencerName]);

  return (
    <div className={styles.container}>
      {status === "loading" ? (
        <div className={styles.loading}>
          <LoadingSpinner />
          <div className={styles.loadingText}>Capturing your payment...</div>
        </div>
      ) : (
        <div className={styles.resultWrap}>
          <PaymentResult
            isSuccessful={status === "success"}
            amount={amount}
            influencerName={influencerName}
            onBack={() => navigate(Paths.home)}
          />
        </div>
      )}
    </div>
  );
}
