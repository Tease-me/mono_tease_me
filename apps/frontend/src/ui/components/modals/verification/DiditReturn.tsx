import { useContext, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Paths } from "@/routes/path";
import styles from "@/ui/components/modals/payment-modal/PayPalReturn.module.css";
import LoadingSpinner from "@/ui/components/loading/LoadingSpinner";
import VerificationResult from "@/ui/components/verification/VerificationResult";
import { AuthContext } from "@/context/AuthContext";
import { storage } from "@/utils/storage";
import { LocalStorageKeys } from "@/constants/localStorageKeys";

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
  const { user, refreshUser } = useContext(AuthContext);

  useEffect(() => {
    const statusParam = params.get("status");
    const sessionId = params.get("verificationSessionId");
    const errorParam = params.get("error");

    if (isApproved(statusParam)) {
      setStatus("success");
      setTimeout(async () => {
        await refreshUser();
        if (user) {
          storage.set(`${LocalStorageKeys.AdultConfirmed}_${user.id}` as LocalStorageKeys, "1");
        }
        navigate(Paths.home, { replace: true });
      }, 1500);
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
  }, [navigate, params, refreshUser, user]);

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
