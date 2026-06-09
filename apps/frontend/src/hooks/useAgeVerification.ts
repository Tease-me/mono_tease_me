import { useContext, useCallback } from "react";
import { AuthContext } from "@/context/AuthContext";
import { storage } from "@/utils/storage";
import { LocalStorageKeys } from "@/constants/localStorageKeys";

function getConfirmedKey(userId: number) {
  return `${LocalStorageKeys.AdultConfirmed}_${userId}`;
}

export function useAgeVerification() {
  const { user } = useContext(AuthContext);

  const hasLocalConfirm = user ? !!storage.get(getConfirmedKey(user.id) as LocalStorageKeys) : false;
  const verificationRequired = user?.verification_required ?? false;

  // Gate is needed when user hasn't locally confirmed AND backend requires verification or soft confirm
  const needsGate = !hasLocalConfirm;

  const markConfirmed = useCallback(() => {
    if (!user) return;
    storage.set(getConfirmedKey(user.id) as LocalStorageKeys, "1");
  }, [user]);

  return {
    needsGate,
    verificationRequired,
    markConfirmed,
  };
}
