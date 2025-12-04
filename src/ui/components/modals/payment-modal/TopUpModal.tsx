import React, { useState } from "react";
import { Modal } from "../Modal";
import styles from "./TopUpModal.module.css";
import TabsLayout from "../../tabs/TabsLayout";
import TextInput from "../../inputs/text-inputs/TextInput";
import SvgPack from "@/utils/SvgPack";
import clsx from "clsx";
import PrimaryButton from "../../inputs/buttons/PrimaryButton";
import NormalButton from "../../inputs/buttons/NormalButton";
import CircularIconButton from "../../inputs/buttons/CircularIconButton";

interface TopUpModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type Step = "amount" | "card" | "low";
const tabs: Step[] = ["amount", "card", "low"];
const stepLabels: Record<Step, string> = {
  amount: "Amount Select",
  card: "Card Details",
  low: "Low Credit"
}


export default function TopUpModal({ isOpen, onClose }: TopUpModalProps) {

  const [topUpState, setTopUpState] = useState<Step>("amount");
  const tabItems = tabs.map((step, index) => ({
    id: index,
    name: stepLabels[step],
    content: <div>{stepLabels[step]}</div>
  }));
  const activeTab = tabItems.find(tab => tabs[tab.id] === topUpState) || (tabItems[0]);

  // Amount Form
  const renderAmountForm = () => {
    return <div>

      <h3 className={styles.mdText}>
        Quick credit selection
      </h3>
      <div className={styles.quickCreditButtonArea}>
        {[5, 10, 30, 50, 100, 500].map((amount) => (
          <NormalButton
            key={amount}
            className={styles.quickCreditButton}
            text={`$${amount}`}
          />
        ))}
      </div>
      <div className={styles.plainDivider}></div>
      <h4 style={{ textAlign: "center", marginBlock: "16px", fontWeight: 400 }}>Or enter a custom amount</h4>
      <div className={styles.customAmountArea}>
        <CircularIconButton size="small" className={styles.paymentCircularButton} text="-" />
        <TextInput size="small" type="number" placeholder="$5" className={styles.customAmountInput} />
        <CircularIconButton className={styles.paymentCircularButton} text="+" />
      </div>
      <div className={styles.cancelRow}>
        <NormalButton
          type="nobg"
          text="Cancel"
          className={styles.cancelButton}
        />
      </div>
      <div className={styles.finalButtonArea}>
        <NormalButton text="Back" disabled={true}></NormalButton>
        <PrimaryButton text="Continue" onClick={() => { }} />
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
        <NormalButton
          type="nobg"
          text="Cancel"
          className={styles.cancelButton}
        />
        <div className={styles.finalButtonArea}>
          <NormalButton text="Back"></NormalButton>
          <PrimaryButton text="Continue" onClick={() => { }} />
        </div>

      </form>


    </div>
  }


  // Low Form
  const renderLowForm = () => {
    return <div>
      <h3 className={styles.mdText}>
        Set Low Credit
      </h3>
      <div className={styles.lowCreditButtonArea}>
        {
          [5, 10, 15, 20].map((amount) => (
            <NormalButton key={amount} className={styles.lowCreditButton} text={`$${amount}`} />
          ))
        }
      </div>
      <div className={styles.lowCreditOptions}>
        <div className={styles.lowCreditOptionsLine}>
          <h3> Auto TopUp when low </h3>
        </div>
        <div className={styles.lowCreditOptionsLine}>
          <h3> Notify me when credit is low</h3>
        </div>
      </div>
      <div className={styles.cancelRow}>
        <NormalButton
          type="nobg"
          text="Cancel"
          className={styles.cancelButton}
        />
      </div>
      <div className={styles.finalButtonArea}>
        <NormalButton text="Back" disabled={true}></NormalButton>
        <PrimaryButton text="Top Up Now" onClick={() => { }} />
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

        <h2 className={styles.heading}>Select top up your credit</h2>
        <div>{renderStep()}</div>
      </div>
    </Modal>
  );
}


