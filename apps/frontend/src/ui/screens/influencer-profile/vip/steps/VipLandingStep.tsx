import teaseMeIcon3D from "@/assets/logos/3D-IconTeaseMe-Dark.svg";
import { InfluencerDataModel } from "@/data/models/InfluencerDataModel";
import IconButton from "@/ui/components/inputs/buttons/IconButton";
import VipInviteCodeInput, {
  VIP_INVITE_CODE_LENGTH,
} from "../components/VipInviteCodeInput";
import styles from "../VipScreen.module.css";
import { InviteProfileValues } from "./VipProfileStep";

type InviteCodeStatus =
  | "idle"
  | "checking"
  | "valid"
  | "invalid"
  | "expired"
  | "redirecting";

type VipLandingStepProps = {
  influencer: InfluencerDataModel;
  profileValues: InviteProfileValues;
  inviteCode: string;
  inviteCodeStatus: InviteCodeStatus;
  invitationValid: boolean;
  invitationExpired: boolean;
  existingAccountMode: boolean;
  existingAccountFollowFailed: boolean;
  showLoginFooter: boolean;
  showCodeEntry: boolean;
  onInviteCodeChange: (value: string) => void;
  onRedeemCode: () => void;
  onRedeemInvite: () => void;
  onRetryAutoFollow: () => void;
  onContinueToInfluencer: () => void;
  onLogin: () => void;
};

export default function VipLandingStep({
  influencer,
  profileValues,
  inviteCode,
  inviteCodeStatus,
  invitationValid,
  invitationExpired,
  existingAccountMode,
  existingAccountFollowFailed,
  showLoginFooter,
  showCodeEntry,
  onInviteCodeChange,
  onRedeemCode,
  onRedeemInvite,
  onRetryAutoFollow,
  onContinueToInfluencer,
  onLogin,
}: VipLandingStepProps) {
  const userName = profileValues.userName.trim();
  const firstName = profileValues.fullName.trim().split(/\s+/)[0];
  const recipientName = userName || firstName || profileValues.email.trim();
  const influencerFirstName =
    influencer.name.trim().split(/\s+/)[0] || influencer.name;
  const codeComplete = inviteCode.trim().length === VIP_INVITE_CODE_LENGTH;
  const isChecking = inviteCodeStatus === "checking";
  const isRedirecting = inviteCodeStatus === "redirecting";
  const showInvalidCode = inviteCodeStatus === "invalid";
  const showValidCode =
    inviteCodeStatus === "valid" || inviteCodeStatus === "redirecting";

  return (
    <>
      <div className={styles.greetingContainer}>
        <div className={styles.logoRow}>
          <img src={teaseMeIcon3D} alt="" />
        </div>
        {existingAccountMode || existingAccountFollowFailed ? (
          <h1 className={styles.title}>Hey, I know you!</h1>
        ) : (
          <h1 className={styles.title}>
            Hi, I'm your{" "}
            <span className={styles.modelName}>{influencerFirstName}</span>
          </h1>
        )}

        {existingAccountMode ? (
          <>
            <p className={styles.message}>
              You already have a TeaseMe Account, {influencerFirstName} has
              automatically been added to your list of models.
            </p>
            <IconButton
              type="square"
              text={`Take me to ${influencerFirstName}`}
              onClick={onContinueToInfluencer}
              className={styles.redeemButton}
            />
          </>
        ) : existingAccountFollowFailed ? (
          <>
            <p className={styles.message}>
              We couldn't add {influencerFirstName} automatically. Please try
              again.
            </p>
            <IconButton
              type="square"
              text="Try Again"
              onClick={onRetryAutoFollow}
              className={styles.redeemButton}
            />
          </>
        ) : showCodeEntry ? (
          <>
            <p className={styles.message}>
              You need an invite code to redeem an invite.
            </p>
            <VipInviteCodeInput
              value={inviteCode}
              onChange={onInviteCodeChange}
              disabled={isChecking || isRedirecting}
            />
            {showInvalidCode && (
              <p className={styles.codeFeedbackInvalid}>invalid code</p>
            )}
            {showValidCode && recipientName && (
              <p className={styles.codeFeedbackValid}>
                {recipientName} you're coming in ;)
              </p>
            )}
            <IconButton
              type="square"
              text={isRedirecting ? "Redirecting.." : "Redeem my code"}
              onClick={onRedeemCode}
              disabled={!codeComplete || isChecking || isRedirecting}
              className={styles.redeemButton}
            />
            <p className={styles.inviteHint}>
              Heads up: the code is valid for <span>2 days only.</span>
            </p>
          </>
        ) : invitationValid ? (
          <>
            <p className={styles.message}>
              This invite is for{" "}
              <span className={styles.email}>{recipientName}</span> ONLY,
              <br />
              please do not share it.
            </p>
            <IconButton
              type="square"
              text="Redeem my invite"
              onClick={onRedeemInvite}
              className={styles.redeemButton}
            />
            <p className={styles.inviteHint}>
              Heads up: the invite is valid for <span>2 days only.</span>
            </p>
          </>
        ) : invitationExpired ? (
          <>
            <p className={styles.message}>
              The invite for{" "}
              <span className={styles.email}>{recipientName}</span> has expired.
            </p>
            <IconButton
              type="square"
              text="Invite Expired"
              disabled
              className={styles.redeemButton}
            />
          </>
        ) : (
          <p className={styles.message}>
            Sorry, invites are not available to the public.
          </p>
        )}
      </div>

      {showLoginFooter && (
        <div className={styles.footer}>
          <p>Already have an account?</p>
          <button className={styles.loginButton} onClick={onLogin}>
            Log In
          </button>
        </div>
      )}
    </>
  );
}
