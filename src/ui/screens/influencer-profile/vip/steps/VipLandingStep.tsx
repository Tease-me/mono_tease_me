import teaseMeIcon3D from "@/assets/logos/3D-IconTeaseMe-Dark.svg";
import { InfluencerDataModel } from "@/data/models/InfluencerDataModel";
import IconButton from "@/ui/components/inputs/buttons/IconButton";
import styles from "../VipScreen.module.css";
import { InviteProfileValues } from "./VipProfileStep";

type VipLandingStepProps = {
  influencer: InfluencerDataModel;
  profileValues: InviteProfileValues;
  invitationValid: boolean;
  invitationExpired: boolean;
  existingAccountMode: boolean;
  existingAccountFollowFailed: boolean;
  showLoginFooter: boolean;
  onRedeemInvite: () => void;
  onRetryAutoFollow: () => void;
  onContinueToInfluencer: () => void;
  onLogin: () => void;
};

export default function VipLandingStep({
  influencer,
  profileValues,
  invitationValid,
  invitationExpired,
  existingAccountMode,
  existingAccountFollowFailed,
  showLoginFooter,
  onRedeemInvite,
  onRetryAutoFollow,
  onContinueToInfluencer,
  onLogin,
}: VipLandingStepProps) {
  const showInviteUnavailable = !invitationValid && !invitationExpired;
  const userName = profileValues.userName.trim();
  const firstName = profileValues.fullName.trim().split(/\s+/)[0];
  const recipientName = userName || firstName || profileValues.email.trim();
  const influencerFirstName =
    influencer.name.trim().split(/\s+/)[0] || influencer.name;

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
        ) : showInviteUnavailable ? (
          <p className={styles.message}>
            Sorry, invites are not available to the public.
          </p>
        ) : null}
      </div>

      {showLoginFooter && (
        <div className={styles.footer}>
          <p>Already have an account?</p>
          <button className={styles.loginButton} onClick={onLogin}>
            Login
          </button>
        </div>
      )}
    </>
  );
}
