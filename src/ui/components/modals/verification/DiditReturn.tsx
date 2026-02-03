import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Paths } from "@/routes/path";
import styles from "@/ui/components/modals/payment-modal/PayPalReturn.module.css";
import LoadingSpinner from "@/ui/components/loading/LoadingSpinner";
import VerificationResult from "@/ui/components/verification/VerificationResult";
type VerificationStatus = "loading" | "success" | "error";

const normalizeStatus = (value?: string | null) =>
  value?.trim().toLowerCase() ?? "";

const isApproved = (value?: string | null) =>
  ["approved", "verified", "success", "passed", "true", "1"].includes(
    normalizeStatus(value),
  );

const isDeclined = (value?: string | null) =>
  ["declined", "failed", "error", "false", "0"].includes(
    normalizeStatus(value),
  );


export default function DiditReturn() {
  const [status, setStatus] = useState<VerificationStatus>("loading");
  const navigate = useNavigate();
  const params = useMemo(() => new URLSearchParams(window.location.search), []);

  useEffect(() => {
    const statusParam = params.get("status");
    const sessionId = params.get("verificationSessionId");
    const errorParam = params.get("error");

    if (isApproved(statusParam)) {
      setStatus("success");
      // setTimeout(() => {
      //   navigate(Paths.home, {
      //     replace: true,
      //     state: { openSubscribe: true },
      //   });
      // }, 1200);
      return;
    }

    if (errorParam || isDeclined(statusParam)) {
      setStatus("error");
      return;
    }

    if (!sessionId) {
      setStatus("error");
      return;
    }

    setStatus("error");
  }, [navigate, params]);

  return (
    <div className={styles.container}>
      {status === "loading" ? (
        <div className={styles.loading}>
          <LoadingSpinner />
          <div>Checking your verification...</div>
        </div>
      ) : (
        <div className={styles.resultWrap}>
          <VerificationResult
            isSuccessful={status === "success"}
            onBack={() => navigate(Paths.home)}
          />
        </div>
      )}
    </div>
  );
}
