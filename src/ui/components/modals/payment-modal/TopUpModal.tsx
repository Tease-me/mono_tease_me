import React, { useEffect, useState } from "react";
import { Modal } from "../Modal";
import styles from "./TopUpModal.module.css";
import TabsLayout from "../../tabs/TabsLayout";
import TextInput from "../../inputs/text-inputs/TextInput";
import SvgPack from "@/utils/SvgPack";
import clsx from "clsx";
import PrimaryButton from "../../inputs/buttons/PrimaryButton";
import NormalButton from "../../inputs/buttons/NormalButton";
import CircularIconButton from "../../inputs/buttons/CircularIconButton";
import Toggle from "../../inputs/toggle/Toggle";


interface TopUpModalProps {
  isOpen: boolean;
  onClose: () => void;
}


export default function TopUpModal({ isOpen, onClose }: TopUpModalProps) {
  type Step = "amount" | "card" | "low";
  const tabs: Step[] = ["amount", "card", "low"];
  const stepLabels: Record<Step, string> = {
    amount: "Amount Select",
    card: "Card Details",
    low: "Low Credit"
  }
  const [topUpState, setTopUpState] = useState<Step>("amount");
  const tabItems = tabs.map((step, index) => ({
    id: index,
    name: stepLabels[step],
    content: <div>{stepLabels[step]}</div>
  }));
  const activeTab = tabItems.find(tab => tabs[tab.id] === topUpState) || (tabItems[0]);

  const [autoTopUp, setAutoTopUp] = useState<boolean>(true);
  const [notifyLow, setNotifyLow] = useState<boolean>(false);

  //Amount selection
  const amountOptions = [5, 10, 30, 50, 100, 500];
  const [selectedAmount, setSelectedAmount] = useState<number | null>(null);
  const [customAmount, setCustomAmount] = useState<number>(5);




  // Amount Form
  const renderAmountForm = () => {
    return <div>

      <h3 className={styles.mdText}>
        Quick credit selection
      </h3>
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
      <h4 style={{ textAlign: "center", marginBlock: "16px", fontWeight: 400 }}>Or enter a custom amount</h4>
      <div className={styles.customAmountArea}>
        <CircularIconButton
          size="small"
          className={styles.paymentCircularButton}
          icon="-"
          onClick={() => {
            setCustomAmount((prev) => (prev ?? 0) - 1)
            setSelectedAmount(() => null)
          }
          }
          disabled={customAmount <= 0}
        />
        <TextInput
          size="small"
          type="number"
          placeholder="$5"
          className={styles.customAmountInput}
          value={customAmount !== null ? customAmount : ""}
          onChange={
            (e) => {
              setCustomAmount(Number(e.currentTarget.value))
              setSelectedAmount(() => null)
            }
          }
        />
        <CircularIconButton
          size="small"
          className={styles.paymentCircularButton}
          icon="+"
          onClick={() => {
            setCustomAmount((prev) => (prev ?? 0) + 1)
            setSelectedAmount(() => null)
          }

          }
        />
      </div>
    </div>
  }

  // Card Form
  const renderCardForm = () => {
    return <div>

      <form className={styles.form} >
        <TextInput
          className={styles.fullWidthInput}
          leftIcon={<SvgPack.Profile />}
          placeholder="Card Holder Name"
          //value={cardHolderName}
          //onChange={(event) => setCardHolderName(event.currentTarget.value)}
          aria-label="Card holder name"
        />

        <TextInput
          className={styles.fullWidthInput}
          leftIcon={<SvgPack.Bill />}
          placeholder="0000 0000 0000 0000"
          // value={cardNumber}
          //onChange={(event) => setCardNumber(event.currentTarget.value)}
          inputMode="numeric"
          aria-label="Card number"
        />

        <div className={styles.inlineFields}>
          <TextInput
            className={clsx(styles.fullWidthInput, styles.inlineFieldInput)}
            leftIcon={<SvgPack.Lock />}
            placeholder="0000"
            //  value={securityCode}
            // onChange={(event) => setSecurityCode(event.currentTarget.value)}
            inputMode="numeric"
            aria-label="Security code"
          />
          <TextInput
            className={clsx(styles.fullWidthInput, styles.inlineFieldInput)}
            leftIcon={<SvgPack.Chat />}
            placeholder="MM/YY"
            //value={expiry}
            //onChange={(event) => setExpiry(event.currentTarget.value)}
            aria-label="Expiry date"
          />
        </div>
      </form>
    </div>
  }

  //Low auto-topup
  const lowCreditOptions = [5, 10, 15, 20];
  const [selectedlowCredit, setSelectedLowCredit] = useState<number>(5);

  // Low Form
  const renderLowForm = () => {
    return <div>
      <h3 className={styles.mdText}>
        Set Low Credit
      </h3>
      <div className={styles.lowCreditButtonArea}>
        {
          lowCreditOptions.map((amount) => (
            <NormalButton key={amount} className={styles.lowCreditButton} text={`$${amount}`}
              selected={selectedlowCredit === amount}
              onClick={() => { setSelectedLowCredit((amt) => { amt = amount; return amt }) }}
            />
          ))
        }
      </div>
      <div className={styles.lowCreditOptions}>
        <div className={styles.lowCreditOptionsLine}>
          <h3> Auto TopUp when low </h3>
          <Toggle checked={autoTopUp} onChange={() => { setAutoTopUp(!autoTopUp) }} />
        </div>
        <div className={styles.lowCreditOptionsLine}>
          <h3> Notify me when credit is low</h3>
          <Toggle checked={notifyLow} onChange={() => { setNotifyLow(!notifyLow) }} />
        </div>
      </div>
    </div>
  }


  const renderStep = () => {
    switch (topUpState) {
      case "amount":
        return renderAmountForm();
      case "card":
        return renderCardForm();
      case "low":
        return renderLowForm();
      default:
        return null;
    }
  }


  return (
    <Modal isOpen={isOpen} onClose={onClose} size="md" ariaLabel="Top up balance" className={styles.modal}>
      <TabsLayout
        tabs={tabItems}
        activeTab={activeTab}
        setActiveTab={(t) => setTopUpState(tabs[t.id])}
      />
      <div className={styles.content}>
        <div>
          <h2 className={styles.heading}>Select top up your credit</h2>
        </div>
        <div>{renderStep()}</div>
        <div className={styles.containerFooter}>
          <div className={styles.cancelRow}>
            <NormalButton
              type="nobg"
              text="Cancel"
              className={styles.cancelButton}
              onClick={onClose}
            />
          </div>
          <div className={styles.finalButtonArea}>
            <NormalButton text="Back"></NormalButton>
            <PrimaryButton text="Continue" onClick={() => { }} />
          </div>
        </div>
      </div>
    </Modal>
  );
}


