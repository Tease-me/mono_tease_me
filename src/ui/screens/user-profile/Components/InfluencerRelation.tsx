import { useEffect, useMemo, useState } from "react";
import clsx from "clsx";
import styles from "./InfluencerRelation.module.css";
import SvgPack from "@/utils/SvgPack";
import { apiClient } from "@/api/apis";
import ProfileMedia from "@/ui/components/ProfileMedia";
import RelationshipRadar from "@/ui/components/visualizations/RelationshipRadart";
import UsageView from "@/ui/components/stats/UsageView";
import PrimaryButton from "@/ui/components/inputs/buttons/PrimaryButton";
import NormalButton from "@/ui/components/inputs/buttons/NormalButton";
import ProgressBar from "@/ui/components/stats/ProgressBar";
import IconButton from "@/ui/components/inputs/buttons/IconButton";
import BalanceBadge from "@/ui/components/stats/BalanceBadge";
import AdultModeToggle from "@/ui/components/adult-mode-toggle/AdultModeToggle";
import { Modal } from "@/ui/components/modals/Modal";
import { formatDateTimeRelative, minutesToTime } from "@/utils/DateTimeUtils";


import { SubscriptionsServices } from "@/api/services/SubscriptionsServices";
import { RelationshipServices } from "@/api/services/RelationshipServices";
import { BalanceServices } from "@/api/services/BalanceServices";
import { UserServices } from "@/api/services/UserServices";
import logger from "@/utils/logger";
import TextInput from "@/ui/components/inputs/text-inputs/TextInput";
import AdultTermsModal from "@/ui/components/modals/adult-terms/AdultTermsModal";
//TODO
// UNFOLLOW BUTTON IS HIDDEN
//CHECK STATUS OF SUBSCRIPTION IF CANCELLED OR REACTIVATED ETC

const relationshipService = RelationshipServices(apiClient);
const balanceService = BalanceServices(apiClient);
const subscriptionService = SubscriptionsServices(apiClient);
const userServices = UserServices(apiClient);

type NavPayload = Record<string, any>;
type Props = {
  navPayload: NavPayload;
  goTo: (id: string, payload?: NavPayload) => void;
  goBack: () => void;
};

type RelationData = {
  id: string;
  name?: string;
  image?: string;
  video?: string;
  lastConnected?: string | Date | null;
  followingSince?: string | null;
  subscriptionStatus?: string | null;
  hasSubscription?: boolean;
  is18?: boolean;
  expiresAt?: string | null;
  //Normal Balance
  balance?: number;
  voiceMinutes?: number;
  msgRemaining?: number,
  //18+ Data
  adultBalance?: number;
  adultVoiceMinutes?: number,
  adultMsgRemaining?: number,
  //Love stats 
  trust?: number;
  safety?: number;
  attraction?: number;
  closeness?: number;
  stageScore?: number;
  state?: string;
};


export default function InfluencerRelation({ navPayload, goTo }: Props) {
  const initial: RelationData = useMemo(
    () => ({
      id: navPayload.influencerId,
      name: navPayload.name,
      image: navPayload.image,
      video: navPayload.video,
      lastConnected: navPayload.lastConnected,
      followingSince: navPayload.followingSince,
      subscriptionStatus: navPayload.subscriptionStatus,
      hasSubscription: navPayload.hasSubscription,
      is18: navPayload.is18,
      expiresAt: navPayload.expiresAt,
      balance: navPayload.balance,
      trust: navPayload.trust,
      safety: navPayload.safety,
      attraction: navPayload.attraction,
      closeness: navPayload.closeness,
      stageScore: navPayload.stageScore,
      state: navPayload.status
    }),
    [navPayload]
  );

  const [data, setData] = useState<RelationData>(initial);
  const [loading, setLoading] = useState(false);

  const [showBalanceDetails, setShowBalanceDetails] = useState(false);
  const [showAdultBalanceDetails, setShowAdultBalanceDetails] = useState(false);
  const [adultModeChecked, setAdultModeChecked] = useState(!!data.hasSubscription && data.subscriptionStatus !== 'cancelled');

  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);
  const [cancelSuccess, setCancelSuccess] = useState(false);
  const [cancelLoading, setCancelLoading] = useState(false);

  const [cancelReason, setCancelReason] = useState("");

  const [showTermsModal, setShowTermsModal] = useState(false);

  useEffect(() => {
    if (!initial.id) return;
    let cancelled = false;
    setLoading(true);

    (async () => {
      try {
        const [rel, bal, sub, u] = await Promise.all([
          relationshipService.getRelationship(initial.id!),
          balanceService.getBalance(initial.id!, false).catch(() => null),
          subscriptionService.getMySubscriptionForInfluencer(initial.id!),
          userServices.getUserUsage(initial.id),
        ]);

        if (cancelled) return;
        setData((d) => ({
          ...d,
          trust: rel?.trust ?? d.trust,
          safety: rel?.safety ?? d.safety,
          attraction: rel?.attraction ?? d.attraction,
          state: rel?.state ?? d.state,
          closeness: rel?.closeness ?? d.closeness,
          stageScore: rel?.sentiment_score ?? d.stageScore,
          lastConnected: rel?.last_interaction_at ?? d.lastConnected,
          balance: bal ? bal.balance_cents / 100 : d.balance,
          hasSubscription: sub?.has_subscription ?? d.hasSubscription,
          subscriptionStatus: sub?.status ?? d.subscriptionStatus,
          is18: sub?.is_18_selected ?? d.is18,
          expiresAt: sub?.current_period_end ?? d.expiresAt,
          voiceMinutes: u?.normal?.live_chat?.remaining_minutes ?? d.voiceMinutes,
          msgRemaining: u?.normal?.messages?.remaining ?? d.msgRemaining,
          adultVoiceMinutes: u?.adult?.voice?.remaining_minutes ?? d.adultVoiceMinutes,
          adultMsgRemaining: u?.adult?.messages?.remaining ?? d.adultMsgRemaining,
        }));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [initial.id]);


  const isSubscribed = !!data.hasSubscription && data.subscriptionStatus !== 'cancelled';

  useEffect(() => {
    setAdultModeChecked(isSubscribed);
  }, [isSubscribed]);

  //Navpayload 
  useEffect(() => {
    setData((d) => ({
      ...d,
      id: navPayload.influencerId ?? d.id,
      image: navPayload.image ?? d.image,
      video: navPayload.video ?? d.video,
      name: navPayload.name ?? d.name,
      followingSince: navPayload.followingSince ?? d.followingSince,
    }));
  }, [navPayload.image, navPayload.video, navPayload.name, navPayload.followingSince]);


  // const onSubscribe = async () => {
  //   if (!data.id) {
  //     return;
  //   }
  //   setLoading(true);
  //   try {
  //     await subscriptionService.startSubscription(data.id, 1);
  //     const sub = await subscriptionService.getMySubscriptionForInfluencer(data.id);
  //     setData((d) => ({
  //       ...d,
  //       hasSubscription: sub?.has_subscription ?? true,
  //       // is18: sub?.is_18_selected ?? true,
  //       expiresAt: sub?.current_period_end ?? d.expiresAt,
  //       voiceMinutes: sub?.voice_minutes ?? d.voiceMinutes,
  //       msgRemaining: sub?.text_messages ?? d.msgRemaining,
  //       adultVoiceMinutes: sub?.voice_minutes ?? d.adultVoiceMinutes,
  //       adultMsgRemaining: sub?.text_messages ?? d.adultMsgRemaining,
  //     }));

  //     setAdultModeChecked(true);
  //     alert('You are now subscribed tot 18+ mode');
  //     // goTo("influencer_profile", { influencerId: data.id });
  //     goBack();
  //   }
  //   catch (e) {
  //     alert(`Error ${e}`);
  //   }
  //   finally {
  //     setLoading(false);
  //   }
  // };


  const handleAdultToggleChange = async () => {
    if (!isSubscribed) {
      //Check if verified
      try {
        await subscriptionService.activateMySubscriptionForInfluencer(data.id, true);
        goTo('subscribe', {
          influencerId: data.id,
          image: data.image,
          onSubscribe: () => {
            goTo("subscription", {
              influencerId: data.id
            })
          }
        });
      }
      catch (err: any) {
        const ageVerified = err?.response?.data?.detai?.verification_status?.is_age_verified
        const idVerified = err?.response?.data?.detai?.verification_status?.is_identity_verified;
        if (!ageVerified && !idVerified) {
          setShowTermsModal(true);
          logger.error(err);
          return;
        }
      }
    }
    else {
      setShowCancelModal(true);
    }

  }
  const handleCancelSubscription = async () => {
    if (!data.id) {
      setCancelError(`Cannot find influencer ID : ${data.id}`);
      logger.error("Cannot find influencer");
      return;
    }
    setCancelError(null);
    setCancelLoading(true);
    try {
      await subscriptionService.cancelSubscription(data.id, cancelReason);
      setCancelSuccess(true);
      setData((d) => ({ ...d, hasSubscription: false, subscriptionStatus: 'cancelled' }));
      setAdultModeChecked(false);
    } catch (e: any) {
      setCancelError("Could not cancel right now.");
      logger.error(e);
    } finally {
      setCancelLoading(false);
      setCancelReason("");
    }
  };

  const handleAddCredits = () => {
    goTo("add_credits", { id: data.id, image: data.image, video: data.video });
  }

  const followingDate = data.followingSince && !Number.isNaN(Date.parse(data.followingSince))
    ? new Date(data.followingSince).toLocaleDateString()
    : "--";

  const onAdultTermsAgreed = () => {

  }


  return (
    <div className={clsx("u-sidebar-page", styles.shell)}>
      {/* Hero */}
      <div className={styles.heroRow}>
        <ProfileMedia imageSrc={data.image} videoSrc={data.video} size="medium" active />
        <div className={styles.heroInfo}>
          <div className={isSubscribed ? styles.badges : styles.badgesHide}>
            <span className={styles.modeText}>
              <span
                className={styles.eighteenPlus}
              >18+</span> Mode
            </span>
            <span className={styles.statusBadge}>
              Subscribed
            </span>
          </div>
          <div className={styles.meta}>
            <span>Last Connected: <strong>{data.lastConnected != null ? formatDateTimeRelative(data.lastConnected) : "--"}</strong></span>
            <span>Following since: {followingDate}</span>
          </div>
        </div>
      </div>

      {/* Balance Card */}
      <div className={styles.balanceCard}>
        <div className={styles.balanceArea}>
          <div className={styles.balanceBadge}>
            <BalanceBadge balance={data.balance ? data.balance : 0} />
          </div>
          <NormalButton type="nobg" className={styles.grayBtn}
            text={!showBalanceDetails ? "View Details" : "Hide Details"}
            onClick={() => setShowBalanceDetails((prev) => !prev)} />
          {showBalanceDetails && (<div className={styles.balanceStats}>
            <UsageView
              label="Voice Minutes"
              tone="green"
              value={data.voiceMinutes != null ? minutesToTime(data.voiceMinutes) : "--"}
            />
            <UsageView
              label="Text Msgs"
              tone="green"
              value={data.msgRemaining != null ? data.msgRemaining.toString() : "--"}
            />
          </div>)}
          <PrimaryButton
            leftIcon={<SvgPack.PlusBox />}
            text="Add Credit"
            onClick={handleAddCredits}
            className={styles.btn}
          />
        </div>
        <div className={styles.adultBalanceArea}>
          {isSubscribed && <NormalButton type="nobg" className={styles.grayBtn} text={!showAdultBalanceDetails ? "View Details" : "Hide Details"} onClick={
            () => { setShowAdultBalanceDetails((prev) => !prev) }
          } />
          }
          {showAdultBalanceDetails && (<div className={styles.adultBalanceStats}>
            <UsageView
              label="Voice Minutes"
              tone="purple"
              value={data.adultVoiceMinutes != null ? minutesToTime(data.adultVoiceMinutes) : "--"}
            />
            <UsageView
              label="Text Msg"
              tone="purple"
              value={data.adultMsgRemaining != null ? data.adultMsgRemaining.toString() : "--"}
            />
          </div>)}
          {showAdultBalanceDetails && <button className={styles.cancelSub} type="button" onClick={() => { setShowCancelModal(true) }}> Cancel Subscription</button>}
          <div className={styles.adultToggleArea}>
            <button type="button" className={styles.adultToggleBtn}>
              <AdultModeToggle checked={adultModeChecked} onChange={handleAdultToggleChange} minutesLeft={data.adultVoiceMinutes} />
            </button>
            {isSubscribed && <p>
              Until: {data.expiresAt ? new Date(data.expiresAt).toLocaleDateString() : "--"}
            </p>}
          </div>
        </div>
      </div>

      {/* Relationship stats area */}
      <div className={styles.relationshipArea}>
        <div className={styles.relationshipHeader}>
          <div className={styles.relationshipTitle}>Relationship Statistics</div>
        </div>
        <div className={styles.progressBar}>
          <ProgressBar mutedLabel label="Relationship Stage Progress" value={data.stageScore ?? 0} max={100} /><p>{data.state}</p>
        </div>

        {/*  radar chart */}
        <div className={styles.radarPlaceholder}>
          <RelationshipRadar
            trust={data.trust ?? 0}
            closeness={data.closeness ?? 0}
            attraction={data.attraction ?? 0}
            safety={data.safety ?? 0}
            height={280}
          />
        </div>
      </div>

      <div className={styles.relationshipStatsArea}>

        <ProgressBar icon={<SvgPack.Trust />} compact label="Trust" value={data.trust ?? 0} max={100} />
        <ProgressBar icon={<SvgPack.Angles />} compact label="Closeness" value={data.closeness ?? 0} max={100} />
        <ProgressBar icon={<SvgPack.KissGray />} compact label="Attraction" value={data.attraction ?? 0} max={100} />
        <ProgressBar icon={<SvgPack.Shield />} compact label="Safety" value={data.safety ?? 0} max={100} />
      </div>

      {/* <div className={styles.unfollow}>
        <IconButton color="black" type="pill" leftIcon={<SvgPack.Delete />} text={`Unfollow ${data.name}`} redText className={styles.unfollowBtn} />
      </div> */}

      {loading && <div className={styles.loading}>Loading…</div>}
      {showCancelModal && (
        <Modal isOpen={showCancelModal} onClose={() => {
          setCancelError("");
          setShowCancelModal(false);
          setCancelSuccess(false);
          setCancelError(null);
        }}
          className={styles.cancelModal}>
          <div className={styles.modalCard}>
            {!cancelSuccess ? (
              <>
                <h3>Cancel 18+ subscription?</h3>
                <p>Upon cancelling, you will no longer be able to have explicit conversation with {data.name}.</p>
                <TextInput type="text" placeholder="Reason for canceling" value={cancelReason} onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setCancelReason(e.target.value)} />
                {cancelError && <div className={styles.modalError}>{cancelError}</div>}
                <div className={styles.modalActions}>
                  <NormalButton type="nobg" onClick={() => {
                    setCancelError("");
                    setShowCancelModal(false);
                    setCancelSuccess(false);
                    setCancelError(null);
                  }} text="Cancel" />
                  <IconButton
                    leftIcon={<SvgPack.Danger />}
                    disabled={cancelLoading}
                    onClick={handleCancelSubscription}
                    text={cancelLoading ? "Working..." : "Confirm"}
                  />
                </div>
              </>
            ) : (
              <>
                <h3>Subscription cancelled</h3>
                <p>18+ mode is now off.</p>
                <div className={styles.modalActions}>
                  <PrimaryButton
                    onClick={() => {
                      setShowCancelModal(false);
                      setCancelSuccess(false);
                    }}
                    text="OK"
                  />
                </div>
              </>
            )}
          </div>
        </Modal>

      )}
      <AdultTermsModal isOpen={showTermsModal} onClose={() => setShowTermsModal(false)} onAgree={onAdultTermsAgreed} />
      {/* Temporary loading to avoid  warning */}
      {loading && <div> </div>}

    </div>
  );
}


