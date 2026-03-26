import React, { useState } from "react";
import PrimaryButton from "@/ui/components/inputs/buttons/PrimaryButton";
import IconButton from "@/ui/components/inputs/buttons/IconButton";
import ProfileMedia from "@/ui/components/ProfileMedia";
import styles from "./AddCredits.module.css";
import TextInput from "@/ui/components/inputs/text-inputs/TextInput";
import NormalButton from "@/ui/components/inputs/buttons/NormalButton";
import LoadingSpinner from "@/ui/components/loading/LoadingSpinner";
import { useArmloopCheckout } from "@/hooks/useArmloopCheckout";

type AddCreditsContentProps = {
  influencerId: string;
  influencerName?: string;
  image?: string;
  video?: string;
  onCancel: () => void;
};

const presets = [
  { label: "$10", value: 10 },
  { label: "$50", value: 50 },
  { label: "$100", value: 100 },
];

const MIN_AMOUNT = 5;

export default function AddCreditsContent({
  influencerId,
  influencerName,
  image,
  video,
  onCancel,
}: Readonly<AddCreditsContentProps>) {
  const [amount, setAmount] = useState(0);
  const { startCheckout, loading, error } = useArmloopCheckout();

  const handleDecrease = () => setAmount((a) => Math.max(0, a - 10));
  const handleIncrease = () => setAmount((a) => a + 10);

  const handleConfirm = async () => {
    if (amount < MIN_AMOUNT) return;
    await startCheckout({
      influencerId,
      amountCents: Math.round(amount * 100),
      influencerName,
    });
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
                onClick={() => setAmount(p.value)}
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

        {loading ? (
          <div className={styles.loadingState}>
            <LoadingSpinner size="small" />
            <div className={styles.loadingText}>Redirecting to payment…</div>
          </div>
        ) : (
          <>
            <PrimaryButton
              text="Confirm"
              disabled={amount < MIN_AMOUNT}
              className={styles.confirmBtn}
              onClick={handleConfirm}
            />
            <NormalButton
              text="Cancel"
              type="nobg"
              className={styles.confirmBtn}
              onClick={onCancel}
            />
            {error && (
              <div className={styles.payError}>{error}</div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
