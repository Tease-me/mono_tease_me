import React, { useState } from "react";
import { Modal } from "../Modal";
import styles from "./TopUpModal.module.css";
import TabsLayout from "../../tabs/TabsLayout";

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

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="sm" ariaLabel="Top up balance" className={styles.modal}>
      <TabsLayout
        tabs={tabItems}
        activeTab={activeTab}
        setActiveTab={(t) => setTopUpState(tabs[t.id])}
      />
    </Modal>
  );
}


