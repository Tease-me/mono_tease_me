import { apiClient } from "@/api/apis";
import { BillingServices } from "@/api/services/BillingServices";
import { Paths } from "@/routes/path";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import PaymentResult from "@/ui/components/payment/PaymentResult";
import styles from "./PayPalReturn.module.css";
import LoadingSpinner from "@/ui/components/loading/LoadingSpinner";
import { storage } from "@/utils/storage";
import { LocalStorageKeys } from "@/constants/localStorageKeys";
import { centsToCredits } from "@/utils/balance_utils";

const billing = BillingServices(apiClient);

export default function PayPalReturn() {
  const [status, setStatus] = useState<"loading" | "success" | "error">(
    "loading",
  );
  const [amount, setAmount] = useState<number | undefined>();
  const [creditedCredits, setCreditedCredits] = useState<number | undefined>();
  const [influencerName, setInfluencerName] = useState<string | undefined>();
  const navigate = useNavigate();
  const fallbackAmount = useMemo(() => {
    const raw = storage.get(LocalStorageKeys.TopUpAmount);
    const parsed = raw ? Number(raw) : NaN;
    return Number.isFinite(parsed) ? parsed : undefined;
  }, []);
  const fallbackInfluencerName = useMemo(() => {
    const raw = storage.get(LocalStorageKeys.TopUpInfluencerName);
    return raw?.trim() || undefined;
  }, []);

  useEffect(() => {
    (async () => {
      // Get checkout_id from localStorage (stored before redirect)
      const checkout_id = storage.get(LocalStorageKeys.CheckoutId);

      if (!checkout_id) {
        setStatus("error");
        return;
      }

      try {
        const res = await billing.verifyCheckout({
          checkout_id,
        });

        if (res?.ok && res.status === "succeeded") {
          const resolvedAmount =
            res.amount_cents != null ? res.amount_cents / 100 : fallbackAmount;
          const resolvedCredits =
            res.credited_credits ??
            (res.amount_cents != null
              ? centsToCredits(res.amount_cents)
              : fallbackAmount != null
                ? centsToCredits(Math.round(fallbackAmount * 100))
                : undefined);

          setAmount(resolvedAmount);
          setCreditedCredits(resolvedCredits);
          storage.remove(LocalStorageKeys.CheckoutId);
          storage.remove(LocalStorageKeys.TopUpInfluencerId);
          storage.remove(LocalStorageKeys.TopUpAmount);
          storage.remove(LocalStorageKeys.TopUpInfluencerName);

          setStatus("success");
          setTimeout(() => navigate(Paths.home), 2000);
        } else if (res?.status === "pending") {
          // Still processing — could retry or show "pending" state
          setStatus("error");
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
      setCreditedCredits(centsToCredits(Math.round(fallbackAmount * 100)));
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
          <div className={styles.loadingText}>Verifying your payment...</div>
        </div>
      ) : (
        <div className={styles.resultWrap}>
          <PaymentResult
            isSuccessful={status === "success"}
            amount={amount}
            creditedCredits={creditedCredits}
            influencerName={influencerName}
            onBack={() => navigate(Paths.home)}
          />
        </div>
      )}
    </div>
  );
}
