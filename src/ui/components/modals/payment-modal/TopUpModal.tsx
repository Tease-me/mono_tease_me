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
import Toggle from "../../inputs/toggle/Toggle";
import AnimatedButton from "../../inputs/buttons/AnimatedButton";


interface TopUpModalProps {
  isOpen: boolean;
  onClose: () => void;
}


export default function TopUpModal({ isOpen, onClose }: TopUpModalProps) {
  type Step = "amount" | "card" | "low" | "success" | "error";
  const tabs: Step[] = ["amount", "card", "low"];
  const stepLabels: Record<Step, string> = {
    amount: "Amount Select",
    card: "Card Details",
    low: "Low Credit",
    success: "Success",
    error: "Error"
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
  const [selectedAmount, setSelectedAmount] = useState<number | null>(5);
  const [customAmount, setCustomAmount] = useState<number>(5);

  const displayValue = customAmount > 0 ? `$${customAmount.toFixed(0)}` : "";
  const minCustomAmout = 5;


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
            setCustomAmount((prev) => Math.max(minCustomAmout, prev - 1));
            setSelectedAmount(() => null)
          }
          }
          disabled={customAmount <= 5}
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
            const coerced = customAmount !== null && customAmount >= minCustomAmout ? customAmount : minCustomAmout;
            setCustomAmount(coerced);
          }}
          className={clsx(styles.customAmountInput)}
        />
        <CircularIconButton
          size="small"
          className={styles.paymentCircularButton}
          icon="+"
          onClick={() => {
            setCustomAmount((prev) => Math.max(minCustomAmout, prev + 1))
            setSelectedAmount(null)
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
    return <div className={styles.lowCreditContainer}>
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

  const renderSuccess = () => {
    return (<div className={styles.resultArea}>
      <div className={styles.resultTitle}>
        <h5 >Payment Successful!</h5>
      </div>
      <div className={styles.resultTrasactionTxt}>
        <h5>Transaction ID</h5>
      </div>
      <div className={styles.resultTransactionId}>
        <h5>#1234567890</h5>
      </div>
      <div className={styles.backHomeBtnArea}>

        <AnimatedButton className={styles.backHomeBtn} text="Back Home" onClick={cancelTopUp} />
      </div>
    </div>)

  }

  const renderError = () => {
    return (<div>
      <h2 className={styles.errorTitle}>Top-up Failed!</h2>
      <h3 className={styles.transactionMessage}>Please try again.</h3>
    </div>)
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
      case "success":
        return renderSuccess();
      case "error":
        return renderError();
        return null;
    }
  }


  const cancelTopUp = () => {
    setTopUpState("amount");
    setSelectedAmount(5);
    setCustomAmount(5);
    onClose();
  }



  const isFormPage = topUpState === "amount" || topUpState === "card" || topUpState === "low";

  return (
    <Modal isOpen={isOpen} onClose={cancelTopUp} size="md" ariaLabel="Top up balance" className={styles.modal}>
      {
        isFormPage && (
          <div className={styles.topUpTabDiv}>
            <TabsLayout
              tabs={tabItems}
              activeTab={activeTab}
              setActiveTab={() => { }} />
          </div>
        )
      }
      <div className={styles.content}>
        {
          isFormPage && (
            <div>
              <h2 className={styles.heading}>Select top up your credit</h2>
            </div>
          )
        }
        <div className={isFormPage ? styles.body : styles.resultContainer}>
          {renderStep()}
        </div>


        {isFormPage &&
          (<div className={styles.containerFooter}>
            <div className={styles.cancelRow}>
              <NormalButton
                type="nobg"
                text="Cancel"
                className={styles.cancelButton}
                onClick={cancelTopUp}
              />
            </div>
            <div className={styles.finalButtonArea}>
              <NormalButton text="Back"
                disabled={topUpState === "amount"}
                onClick={() => {
                  switch (topUpState) {
                    case "card":
                      setTopUpState("amount");
                      break;
                    case "low":
                      setTopUpState("card");
                      break;
                    default:
                      break;
                  }

                }}

              ></NormalButton>

              <PrimaryButton
                text={topUpState === "low" ? "Top Up Now" : "Continue"}
                onClick={() => {
                  switch (topUpState) {
                    case "amount":
                      setTopUpState("card");
                      break;
                    case "card":
                      setTopUpState("low");
                      break;
                    case "low":
                      setTopUpState("success");
                      break;
                  }
                }}
              />
            </div>
          </div>)}

      </div>
    </Modal >
  );
}


