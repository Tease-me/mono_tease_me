import clsx from "clsx";
import { useState } from "react";
import AnimatedButton from "../../inputs/buttons/AnimatedButton";
import CircularIconButton from "../../inputs/buttons/CircularIconButton";
import NormalButton from "../../inputs/buttons/NormalButton";
import PrimaryButton from "../../inputs/buttons/PrimaryButton";
import TextInput from "../../inputs/text-inputs/TextInput";
import Toggle from "../../inputs/toggle/Toggle";
import TabsLayout from "../../tabs/TabsLayout";
import { Modal } from "../Modal";
import styles from "./TopUpModal.module.css";

import { apiClient } from "@/api/apis";
import { BillingServices } from "@/api/services/BillingServices";
import { LocalStorageKeys } from "@/constants/localStorageKeys";
import { storage } from "@/utils/storage";

//MAKE SURE TO PASS INFLUENCER
const influencerTEMPORARY = "";

const billing = BillingServices(apiClient);

interface TopUpModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function TopUpModal({ isOpen, onClose }: TopUpModalProps) {
  type Step = "amount" | "low" | "success" | "error";
  const tabs: Step[] = ["amount", "low"];
  const stepLabels: Record<Step, string> = {
    amount: "Amount Select",
    low: "Low Credit",
    success: "Success",
    error: "Error",
  };

  const [topUpState, setTopUpState] = useState<Step>("amount");
  const tabItems = tabs.map((step, index) => ({
    id: index,
    name: stepLabels[step],
    content: <div>{stepLabels[step]}</div>,
  }));
  const activeTab =
    tabItems.find((tab) => tabs[tab.id] === topUpState) || tabItems[0];

  const [autoTopUp, setAutoTopUp] = useState<boolean>(true);
  const [notifyLow, setNotifyLow] = useState<boolean>(false);

  // Amount selection
  const amountOptions = [5, 10, 30, 50, 100, 500];
  const [selectedAmount, setSelectedAmount] = useState<number | null>(5);
  const [customAmount, setCustomAmount] = useState<number>(5);

  const displayValue = customAmount > 0 ? `$${customAmount.toFixed(0)}` : "";
  const minCustomAmout = 5;

  // Payment state
  const [isPaying, setIsPaying] = useState(false);
  const [payError, setPayError] = useState<string | null>(null);
  const [provider, setProvider] = useState<"armloop" | "stripe">("armloop");

  const startCheckout = async () => {
    try {
      setIsPaying(true);
      setPayError(null);

      const dollars = Number(customAmount || 0);
      if (!Number.isFinite(dollars) || dollars < minCustomAmout) {
        setPayError(`Minimum top up is $${minCustomAmout}.`);
        return;
      }

      const cents = Math.round(dollars * 100);

      const { payment_url, checkout_id } = await billing.createCheckout({
        amount_cents: cents,
        influencer_id: influencerTEMPORARY,
        purpose: "topup",
        provider,
      });

      // store for return page
      storage.set(LocalStorageKeys.CheckoutId, checkout_id);
      storage.set(LocalStorageKeys.TopUpAmount, String(dollars));

      // redirect user to payment page
      window.location.href = payment_url;
    } catch (e: any) {
      setPayError(e?.message || "Payment failed. Please try again.");
      setTopUpState("error");
    } finally {
      setIsPaying(false);
    }
  };

  // Amount Form
  const renderAmountForm = () => {
    return (
      <div>
        <h3 className={styles.mdText}>Quick credit selection</h3>
        <div className={styles.quickCreditButtonArea}>
          {amountOptions.map((amount) => (
            <NormalButton
              key={amount}
              className={styles.quickCreditButton}
              text={`$${amount}`}
              onClick={() => {
                setSelectedAmount(amount);
                setCustomAmount(amount);
              }}
              selected={selectedAmount === amount}
            />
          ))}
        </div>
        <div className={styles.plainDivider}></div>
        <h4
          style={{ textAlign: "center", marginBlock: "16px", fontWeight: 400 }}
        >
          Or enter a custom amount
        </h4>
        <div className={styles.customAmountArea}>
          <CircularIconButton
            size="small"
            className={styles.paymentCircularButton}
            icon="-"
            onClick={() => {
              setCustomAmount((prev) => Math.max(minCustomAmout, prev - 1));
              setSelectedAmount(null);
            }}
            disabled={customAmount <= minCustomAmout}
          />

          <TextInput
            type="text"
            value={displayValue}
            onChange={(e) => {
              const raw = e.currentTarget.value.replace(/[^0-9.]/g, "");
              const num = raw ? parseFloat(raw) : 0;
              const clamped = isNaN(num) ? 0 : num;
              setCustomAmount(clamped);
              setSelectedAmount(null);
            }}
            onBlur={() => {
              const coerced =
                customAmount !== null && customAmount >= minCustomAmout
                  ? customAmount
                  : minCustomAmout;
              setCustomAmount(coerced);
            }}
            className={clsx(styles.customAmountInput)}
          />

          <CircularIconButton
            size="small"
            className={styles.paymentCircularButton}
            icon="+"
            onClick={() => {
              setCustomAmount((prev) => Math.max(minCustomAmout, prev + 1));
              setSelectedAmount(null);
            }}
          />
        </div>
      </div>
    );
  };

  // Low auto-topup
  const lowCreditOptions = [5, 10, 15, 20];
  const [selectedlowCredit, setSelectedLowCredit] = useState<number>(5);

  // Low Form
  const renderLowForm = () => {
    return (
      <div className={styles.lowCreditContainer}>
        <h3 className={styles.mdText}>Set Low Credit</h3>

        <div className={styles.lowCreditButtonArea}>
          {lowCreditOptions.map((amount) => (
            <NormalButton
              key={amount}
              className={styles.lowCreditButton}
              text={`$${amount}`}
              selected={selectedlowCredit === amount}
              onClick={() => setSelectedLowCredit(amount)}
            />
          ))}
        </div>

        <div className={styles.lowCreditOptions}>
          <div className={styles.lowCreditOptionsLine}>
            <h3> Auto TopUp when low </h3>
            <Toggle
              checked={autoTopUp}
              onChange={() => setAutoTopUp(!autoTopUp)}
            />
          </div>
          <div className={styles.lowCreditOptionsLine}>
            <h3> Notify me when credit is low</h3>
            <Toggle
              checked={notifyLow}
              onChange={() => setNotifyLow(!notifyLow)}
            />
          </div>
        </div>

        {payError && (
          <div style={{ marginTop: 12 }}>
            <h3 className={styles.errorTitle}>{payError}</h3>
          </div>
        )}

        <h3 className={styles.mdText} style={{ marginTop: 16 }}>
          Payment Method
        </h3>
        <div className={styles.quickCreditButtonArea}>
          <NormalButton
            text="Armloop"
            className={styles.quickCreditButton}
            selected={provider === "armloop"}
            onClick={() => setProvider("armloop")}
          />
          {/* <NormalButton
            text="Stripe"
            className={styles.quickCreditButton}
            selected={provider === "stripe"}
            onClick={() => setProvider("stripe")}
          /> */}
          {/* <NormalButton
            text="PayPal"
            className={styles.quickCreditButton}
            selected={provider === "paypal"}
            onClick={() => setProvider("paypal")}
          /> */}
        </div>
      </div>
    );
  };

  const renderSuccess = () => {
    return (
      <div className={styles.resultArea}>
        <div className={styles.resultTitle}>
          <h5>Payment Successful!</h5>
        </div>
        <div className={styles.resultTrasactionTxt}>
          <h5>Transaction</h5>
        </div>
        <div className={styles.resultTransactionId}>
          <h5>Check your balance</h5>
        </div>
        <div className={styles.backHomeBtnArea}>
          <AnimatedButton
            className={styles.backHomeBtn}
            type="square"
            text="Back Home"
            onClick={cancelTopUp}
          />
        </div>
      </div>
    );
  };

  const renderError = () => {
    return (
      <div>
        <h2 className={styles.errorTitle}>Top-up Failed!</h2>
        <h3 className={styles.transactionMessage}>
          {payError || "Please try again."}
        </h3>
      </div>
    );
  };

  const renderStep = () => {
    switch (topUpState) {
      case "amount":
        return renderAmountForm();
      case "low":
        return renderLowForm();
      case "success":
        return renderSuccess();
      case "error":
        return renderError();
      default:
        return null;
    }
  };

  const cancelTopUp = () => {
    setTopUpState("amount");
    setSelectedAmount(5);
    setCustomAmount(5);
    setPayError(null);
    setIsPaying(false);
    onClose();
  };

  const isFormPage = topUpState === "amount" || topUpState === "low";

  return (
    <Modal
      isOpen={isOpen}
      onClose={cancelTopUp}
      size="md"
      ariaLabel="Top up balance"
      className={styles.modal}
    >
      {isFormPage && (
        <div className={styles.topUpTabDiv}>
          <TabsLayout
            tabs={tabItems}
            activeTab={activeTab}
            setActiveTab={() => {}}
          />
        </div>
      )}

      <div className={styles.content}>
        {isFormPage && (
          <div>
            <h2 className={styles.heading}>Select top up your credit</h2>
          </div>
        )}

        <div className={isFormPage ? styles.body : styles.resultContainer}>
          {renderStep()}
        </div>

        {isFormPage && (
          <div className={styles.containerFooter}>
            <div className={styles.cancelRow}>
              <NormalButton
                type="nobg"
                text="Cancel"
                className={styles.cancelButton}
                onClick={cancelTopUp}
                disabled={isPaying}
              />
            </div>

            <div className={styles.finalButtonArea}>
              <NormalButton
                text="Back"
                disabled={topUpState === "amount" || isPaying}
                onClick={() => {
                  if (isPaying) return;
                  switch (topUpState) {
                    case "low":
                      setTopUpState("amount");
                      break;
                    default:
                      break;
                  }
                }}
              />

              <PrimaryButton
                text={
                  topUpState === "low"
                    ? isPaying
                      ? "Redirecting…"
                      : "Top Up Now"
                    : "Continue"
                }
                disabled={isPaying}
                onClick={() => {
                  if (isPaying) return;
                  switch (topUpState) {
                    case "amount":
                      setTopUpState("low");
                      break;
                    case "low":
                      startCheckout();
                      break;
                    default:
                      break;
                  }
                }}
              />
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
