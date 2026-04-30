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
    const searchParams = new URLSearchParams(window.location.search);
    const fpr = searchParams.get("fpr");
    const inviteCode = searchParams.get("inviteCode");
    const inviteeEmail = searchParams.get("inviteeEmail");
    const inviterEmail = searchParams.get("inviterEmail");
    const accountManagerEmail = searchParams.get("accountManagerEmail");
    const joinAttribution = {
      fpr: fpr ?? undefined,
      inviteCode: inviteCode ?? undefined,
      inviteeEmail: inviteeEmail ?? undefined,
      inviterEmail: inviterEmail ?? undefined,
      accountManagerEmail: accountManagerEmail ?? undefined,
    };

    if (fpr) storage.set(LocalStorageKeys.ParentRefId, fpr);
    if (Object.values(joinAttribution).some(Boolean)) {
      storage.setObject(LocalStorageKeys.JoinAttribution, joinAttribution);
      return;
    }
    storage.remove(LocalStorageKeys.JoinAttribution);
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
