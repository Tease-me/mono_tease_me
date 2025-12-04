import React, { useState } from "react";
import { Modal } from "../Modal";
import styles from "./TopUpModal.module.css";
import TabsLayout from "../../tabs/TabsLayout";
import TextInput from "../../inputs/text-inputs/TextInput";
import SvgPack from "@/utils/SvgPack";
import clsx from "clsx";
import PrimaryButton from "../../inputs/buttons/PrimaryButton";
import NormalButton from "../../inputs/buttons/NormalButton";


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

      <h3 style={{ textAlign: "center", marginBlock: "16px", fontWeight: 400 }}>Quick credit selection</h3>





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
        <button className={styles.cancelButton}>cancel</button>
        <div className={styles.finalButtonArea}>
          <NormalButton text="Back"></NormalButton>
          <PrimaryButton text="Submit" onClick={() => { }} />
        </div>

      </form>


    </div>
  }


  // Amount Form
  const renderForm = () => {
    return <div>


    </div>
  }


  const renderStep = () => {
    switch (topUpState) {
      case "amount":
        return renderAmountForm();
      case "card":
        return renderCardForm();
      case "low":
        return renderForm();
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
      <h2 className={styles.heading}>Select top up your credit</h2>
      <div>{renderStep()}</div>
    </Modal>
  );
}


