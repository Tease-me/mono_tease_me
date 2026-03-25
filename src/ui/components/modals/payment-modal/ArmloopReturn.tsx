import { apiClient } from "@/api/apis";
import { BillingServices } from "@/api/services/BillingServices";
import { Paths } from "@/routes/path";
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import PaymentResult from "@/ui/components/payment/PaymentResult";
import styles from "./PayPalReturn.module.css";
import LoadingSpinner from "@/ui/components/loading/LoadingSpinner";
import { storage } from "@/utils/storage";
import { LocalStorageKeys } from "@/constants/localStorageKeys";

const billing = BillingServices(apiClient);

export default function ArmloopReturn() {
  const [status, setStatus] = useState<"loading" | "success" | "error">(
    "loading",
  );
  const [amount, setAmount] = useState<number | undefined>();
  const [influencerName, setInfluencerName] = useState<string | undefined>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const fallbackAmount = useMemo(() => {
    const raw = storage.get(LocalStorageKeys.TopUpAmount);
    const parsed = raw ? Number(raw) : Number.NaN;
    return Number.isFinite(parsed) ? parsed : undefined;
  }, []);

  const fallbackInfluencerName = useMemo(() => {
    const raw = storage.get(LocalStorageKeys.TopUpInfluencerName);
    return raw?.trim() || undefined;
  }, []);

  useEffect(() => {
    (async () => {
      const checkout_id = storage.get(LocalStorageKeys.CheckoutId);
      const sessionId = searchParams.get("sessionId") ?? undefined;
      const sessionResult = searchParams.get("sessionResult") ?? undefined;

      if (!checkout_id) {
        setStatus("error");
        return;
      }

      try {
        const res = await billing.verifyCheckout({
          checkout_id,
          session_id: sessionId,
          session_result: sessionResult,
        });

        if (res?.ok && res.status === "succeeded") {
          storage.remove(LocalStorageKeys.CheckoutId);
          storage.remove(LocalStorageKeys.TopUpInfluencerId);
          storage.remove(LocalStorageKeys.TopUpAmount);
          storage.remove(LocalStorageKeys.TopUpInfluencerName);

          setStatus("success");
          setTimeout(() => navigate(Paths.home), 2000);
        } else if (res?.status === "pending") {
          setStatus("error");
        } else {
          setStatus("error");
        }
      } catch {
        setStatus("error");
      }
    })();
  }, [navigate, searchParams]);

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
          <div className={styles.loadingText}>Verifying your payment...</div>
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
