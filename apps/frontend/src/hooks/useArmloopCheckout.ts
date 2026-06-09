import { apiClient } from "@/api/apis";
import { Endpoints } from "@/api/urls";
import { LocalStorageKeys } from "@/constants/localStorageKeys";
import { storage } from "@/utils/storage";
import { useState } from "react";

interface StartCheckoutParams {
  influencerId: string;
  amountCents: number;
  influencerName?: string;
}

interface ArmloopSessionRes {
  id: string;
  url: string;
  returnUrl: string;
  reference: string;
  amount: { currency: string; value: number };
  expiresAt: string;
}

export function useArmloopCheckout() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function startCheckout({
    influencerId,
    amountCents,
    influencerName,
  }: StartCheckoutParams) {
    setLoading(true);
    setError(null);

    try {
      const res = await apiClient.post<ArmloopSessionRes>(
        Endpoints.armloop.createSession,
        {
          influencer_id: influencerId,
          amount_cents: amountCents,
        },
      );

      const session = res.data;

      // Persist session id for ArmloopReturn verification
      storage.set(LocalStorageKeys.CheckoutId, session.id);
      storage.set(LocalStorageKeys.TopUpInfluencerId, influencerId);
      storage.set(LocalStorageKeys.TopUpAmount, String(amountCents / 100));
      if (influencerName) {
        storage.set(LocalStorageKeys.TopUpInfluencerName, influencerName);
      }

      globalThis.location.href = session.url;
    } catch (err: any) {
      const message =
        err.response?.data?.detail ??
        err.response?.data?.message ??
        err.message ??
        "Payment failed";
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  return { startCheckout, loading, error };
}
