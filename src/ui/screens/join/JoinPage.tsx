import { useEffect } from "react";
import TeaseMeIncomeCalculatorSection from "./sections/TeaseMeIncomeCalculatorSection";
import TeaseMeIncomeSection from "./sections/TeaseMeIncomeSection";
import TeaseMeJoin from "./sections/TeaseMeJoin";
import TeaseMeProcessSection from "./sections/TeaseMeProcessSection";
import TeaseMeVideoSection from "./sections/TeaseMeVideoSection";
import TeaseMeWhySection from "./sections/TeaseMeWhySection";
import { storage } from "@/utils/storage";
import { LocalStorageKeys } from "@/constants/localStorageKeys";

export default function JoinPage() {
  useEffect(() => {
    const fpr = new URLSearchParams(window.location.search).get("fpr");
    if (fpr) storage.set(LocalStorageKeys.ParentRefId, fpr);
  }, []);

  return (
    <div style={{ overflowY: "auto", overflowX: "hidden" }}>
      <TeaseMeJoin />
      <TeaseMeVideoSection />
      <TeaseMeIncomeSection />
      <TeaseMeWhySection />
      <TeaseMeProcessSection />
      <TeaseMeIncomeCalculatorSection />
    </div>
  );
}
