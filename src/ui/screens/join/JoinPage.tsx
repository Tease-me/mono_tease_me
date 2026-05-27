import { useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import TeaseMeIncomeCalculatorSection from "./sections/TeaseMeIncomeCalculatorSection";
import TeaseMeIncomeSection from "./sections/TeaseMeIncomeSection";
import TeaseMeJoin from "./sections/TeaseMeJoin";
import TeaseMeProcessSection from "./sections/TeaseMeProcessSection";
import TeaseMeVideoSection from "./sections/TeaseMeVideoSection";
import TeaseMeWhySection from "./sections/TeaseMeWhySection";
import ProfileSurvey from "./subscreens/ProfileSurvey";
import { storage } from "@/utils/storage";
import { LocalStorageKeys } from "@/constants/localStorageKeys";

export default function JoinPage() {
  const [searchParams] = useSearchParams();
  const fpr = searchParams.get("fpr");
  const inviteCode = searchParams.get("inviteCode");
  const inviteeEmail = searchParams.get("inviteeEmail");
  const inviterEmail = searchParams.get("inviterEmail");
  const accountManagerEmail = searchParams.get("accountManagerEmail");

  const hasJoinAttribution = Boolean(
    fpr || inviteCode || inviteeEmail || inviterEmail || accountManagerEmail,
  );

  useEffect(() => {
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
  }, [accountManagerEmail, fpr, inviteCode, inviteeEmail, inviterEmail]);

  if (hasJoinAttribution) {
    return <ProfileSurvey initialEmail={inviteeEmail ?? ""} />;
  }

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
