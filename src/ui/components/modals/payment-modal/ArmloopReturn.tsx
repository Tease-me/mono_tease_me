import { Paths } from "@/routes/path";
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import PaymentResult from "@/ui/components/payment/PaymentResult";
import styles from "./PayPalReturn.module.css";
import LoadingSpinner from "@/ui/components/loading/LoadingSpinner";
import { storage } from "@/utils/storage";
import { LocalStorageKeys } from "@/constants/localStorageKeys";

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
    if (fallbackAmount !== undefined) setAmount(fallbackAmount);
    if (fallbackInfluencerName) setInfluencerName(fallbackInfluencerName);
  }, [fallbackAmount, fallbackInfluencerName]);

  useEffect(() => {
    const sessionId = searchParams.get("sessionId");
    const sessionResult = searchParams.get("sessionResult");

    if (!sessionId || !sessionResult) {
      setStatus("error");
      return;
    }

    // Payment verification is handled server-side via Armloop webhook.
    // The return URL is only for redirecting the user — show success and
    // clean up localStorage.
    storage.remove(LocalStorageKeys.CheckoutId);
    storage.remove(LocalStorageKeys.TopUpInfluencerId);
    storage.remove(LocalStorageKeys.TopUpAmount);
    storage.remove(LocalStorageKeys.TopUpInfluencerName);

    setStatus("success");
    setTimeout(() => navigate(Paths.home), 3000);
  }, [navigate, searchParams]);

  return (
    <div className={styles.container}>
      {status === "loading" ? (
        <div className={styles.loading}>
          <LoadingSpinner />
          <div className={styles.loadingText}>Processing your payment…</div>
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
