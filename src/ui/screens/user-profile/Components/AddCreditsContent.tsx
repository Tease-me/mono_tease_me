import React, { useState } from "react";
import PrimaryButton from "@/ui/components/inputs/buttons/PrimaryButton";
import IconButton from "@/ui/components/inputs/buttons/IconButton";
import ProfileMedia from "@/ui/components/ProfileMedia";
import styles from "./AddCredits.module.css";
import TextInput from "@/ui/components/inputs/text-inputs/TextInput";
import { BillingServices } from "@/api/services/BillingServices";
import { apiClient } from "@/api/apis";
import NormalButton from "@/ui/components/inputs/buttons/NormalButton";
import { storage } from "@/utils/storage";
import { LocalStorageKeys } from "@/constants/localStorageKeys";

const billing = BillingServices(apiClient);

type AddCreditsContentProps = {
  influencerId: string;
  image?: string;
  video?: string;
  onCancel: () => void;
};

type Presets = {
  label: string;
  value: number;
};

const presets: Presets[] = [
  { label: "10$", value: 10 },
  { label: "$50", value: 50 },
  { label: "$100", value: 100 },
];

export default function AddCreditsContent({
  influencerId,
  image,
  video,
  onCancel,
}: AddCreditsContentProps) {
  const initialAmount = 0;

  const [amount, setAmount] = useState(initialAmount);

  const handleDecrease = () => setAmount((a) => Math.max(0, a - 10));
  const handleIncrease = () => setAmount((a) => a + 10);

  const handleConfirmPayment = () => {
    startPayPalTopUp();
  };

  // PayPal state
  const [isPaying, setIsPaying] = useState(false);
  const [payError, setPayError] = useState<string | null>(null);
  const minCustomAmout = 5;

  const startPayPalTopUp = async () => {
    try {
      setIsPaying(true);
      setPayError(null);

      const dollars = Number(amount || 0);
      if (!Number.isFinite(dollars) || dollars < minCustomAmout) {
        setPayError(`Minimum top up is $${minCustomAmout}.`);
        return;
      }

      const cents = Math.round(dollars * 100);

      // Create PayPal order on backend (cookie auth)
      const { approve_url, order_id } = await billing.paypalCreateOrder({
        cents,
        currency: "AUD",
        influencer_id: influencerId,
      });

      // store for return page fallback
      storage.set(LocalStorageKeys.PayPalOrderId, order_id);
      storage.set(LocalStorageKeys.PayPalTopUpInfluencerId, influencerId);
      storage.set(LocalStorageKeys.PayPalTopUpAmount, String(dollars));

      // redirect user to PayPal approval page
      window.location.href = approve_url;
    } catch (e: any) {
      setPayError(e?.message || "PayPal top up failed. Please try again.");
    } finally {
      setIsPaying(false);
    }
  };

  return (
    <div className={styles.addCredits}>
      <ProfileMedia size="large" imageSrc={image} videoSrc={video} active />

      <div className={styles.selectionBox}>
        <div className={styles.presetsBox}>
          <h4>Quick Presets</h4>
          <div className={styles.presetList}>
            {presets.map((p) => (
              <IconButton
                key={p.value}
                text={p.label}
                color="black"
                type="pill"
                onClick={() => {
                  setAmount(p.value);
                }}
              />
            ))}
          </div>
        </div>

        <div className={styles.customAmountArea}>
          <IconButton
            text={"-"}
            color="black"
            type="pill"
            onClick={handleDecrease}
            className={styles.customBtn}
          />
          <TextInput
            leftIcon="$"
            className={styles.amountInput}
            type="number"
            value={`${amount}`}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
              setAmount(Number(e.target.value) || 0);
            }}
            size="medium"
          />
          <IconButton
            text={"+"}
            color="black"
            type="pill"
            onClick={handleIncrease}
            className={styles.customBtn}
          />
        </div>
        <PrimaryButton
          text="Confirm"
          disabled={amount <= 0 || isPaying}
          className={styles.confirmBtn}
          onClick={handleConfirmPayment}
        />
        <NormalButton
          text="Cancel"
          type="nobg"
          className={styles.confirmBtn}
          onClick={onCancel}
        />
        {payError && (
          <div className={styles.payError}>{isPaying ? "" : payError}</div>
        )}
      </div>
    </div>
  );
}
