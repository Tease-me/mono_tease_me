import { useEffect, useMemo, useState } from "react";
import styles from "./InfluencerRelation.module.css";
import SvgPack from "@/utils/SvgPack";
import { apiClient } from "@/api/apis";
import ProfileMedia from "@/ui/components/ProfileMedia";
import RelationshipRadar from "@/ui/components/visualizations/RelationshipRadart";
import UsageView from "@/ui/components/stats/UsageView";
import PrimaryButton from "@/ui/components/inputs/buttons/PrimaryButton";
import NormalButton from "@/ui/components/inputs/buttons/NormalButton";
import ProgressBar from "@/ui/components/stats/ProgressBar";
import BalanceBadge from "@/ui/components/stats/BalanceBadge";
import AdultModeToggle from "@/ui/components/adult-mode-toggle/AdultModeToggle";
import { Modal } from "@/ui/components/modals/Modal";

import { formatDateTimeRelative } from "@/utils/DateTimeUtils";


import { SubscriptionsServices } from "@/api/services/SubscriptionsServices";
import { RelationshipServices } from "@/api/services/RelationshipServices";
import { BalanceServices } from "@/api/services/BalanceServices";
import IconButton from "@/ui/components/inputs/buttons/IconButton";

//TODO
// UNFOLLOW BUTTON
// 18+ TOGGLE ON = GO TO SUBSCRIBE PAGE
//RELATIONSHIP RADAR CSS WARNING

const relationshipService = RelationshipServices(apiClient);
const balanceService = BalanceServices(apiClient);
const subscriptionService = SubscriptionsServices(apiClient);

type NavPayload = Record<string, any>;
type Props = {
  navPayload: NavPayload;
  goTo: (id: string, payload?: NavPayload) => void;
  goBack: () => void;
};

type RelationData = {
  id?: string;
  name?: string;
  image?: string;
  video?: string;
  lastConnected?: string | Date | null;
  followingSince?: string | null;
  subscriptionStatus?: string | null;
  hasSubscription?: boolean;
  is18?: boolean;
  expiresAt?: string | null;
  voiceMinutes?: number;
  textMessages?: number;
  balance?: number;
  callTime?: string,
  msgRemaining?: number,
  adultBalance?: number;
  adultCallTime?: string,
  adultMsgRemaining?: number,
  trust?: number;
  safety?: number;
  attraction?: number;
  closeness?: number;
  stageScore?: number;
};


export default function InfluencerRelation({ navPayload, goTo }: Props) {
  const initial: RelationData = useMemo(
    () => ({
      id: navPayload.influencerId,
      name: navPayload.name,
      image: navPayload.image,
      video: navPayload.video,
      lastConnected: formatDateTimeRelative(navPayload.lastConnected),
      followingSince: navPayload.followingSince,
      subscriptionStatus: navPayload.subscriptionStatus,
      hasSubscription: navPayload.hasSubscription,
      is18: navPayload.is18,
      expiresAt: navPayload.expiresAt,
      voiceMinutes: navPayload.voiceMinutes,
      textMessages: navPayload.textMessages,
      balance: navPayload.balance,
      trust: navPayload.trust,
      safety: navPayload.safety,
      attraction: navPayload.attraction,
      closeness: navPayload.closeness,
      stageScore: navPayload.stageScore,
    }),
    [navPayload]
  );

  const [data, setData] = useState<RelationData>(initial);
  const [loading, setLoading] = useState(false);

  const [showBalanceDetails, setShowBalanceDetails] = useState(false);
  const [showAdultBalanceDetails, setShowAdultBalanceDetails] = useState(false);
  const [adultModeChecked, setAdultModeChecked] = useState(data.is18 || false);

  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);
  const [cancelSuccess, setCancelSuccess] = useState(false);
  const [cancelLoading, setCancelLoading] = useState(false);

  useEffect(() => {
    if (!initial.id) return;
    const needsDetails =
      data.trust === undefined ||
      data.safety === undefined ||
      data.attraction === undefined ||
      data.closeness === undefined ||
      data.stageScore === undefined ||
      data.is18 === undefined;

    if (!needsDetails) return;

    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const [rel, bal, sub] = await Promise.all([
          relationshipService.getRelationship(initial.id!),
          balanceService.getBalance(initial.id!, false).catch(() => null),
          subscriptionService.getMySubscriptionForInfluencer(initial.id!)

        ]);

        if (!cancelled) {
          setData((d) => ({
            ...d,
            trust: rel.trust,
            safety: rel.safety,
            attraction: rel.attraction,
            closeness: rel.closeness,
            stageScore: rel.sentiment_score,
            lastConnected: rel.last_interaction_at,
            followingSince: rel.last_interaction_at,
            balance: bal ? bal.balance_cents / 100 : d.balance,
            hasSubscription: sub?.has_subscription,
            is18: sub?.is_18_selected ?? d.is18,
            expiresAt: sub?.expires_at ?? d.expiresAt,
            voiceMinutes: sub?.voice_minutes ?? d.voiceMinutes,
            textMessages: sub?.text_messages ?? d.textMessages,
          }));

        }
      } catch (e) {
        console.error("Failed to load relation details", e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [initial.id]);

  useEffect(() => {
    setAdultModeChecked(!!data.is18);
  }, [data.is18]);

  const handleAdultToggleChange = async () => {
    const a = adultModeChecked;
    setAdultModeChecked(!a);
  }
  const handleCancelSubscription = async () => {
    if (!data.id) return;
    setCancelError(null);
    setCancelLoading(true);
    try {
      await subscriptionService.activateMySubscriptionForInfluencer(data.id, false);
      setCancelSuccess(true);
      setAdultModeChecked(false);
      setData((d) => ({ ...d, is18: false, hasSubscription: false }));
    } catch (e: any) {
      setCancelError(e?.message || "Could not cancel right now.");
    } finally {
      setCancelLoading(false);
    }
  };

  const handleAddCredits = () => {
    goTo("add_credits", {id: data.id, image: data.image, video: data.video});
  }



  return (
    <div className={styles.shell}>
      {/* Hero */}
      <div className={styles.heroRow}>
        <ProfileMedia imageSrc={data.image} videoSrc={data.video} size="medium" active />
        <div className={styles.heroInfo}>
          <div className={data.is18 ? styles.badges : styles.badgesHide}>
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
            <span>Last Connected: <strong>{data.lastConnected ? formatDateTimeRelative(data.lastConnected) : "--"}</strong></span>
            <span>Following since {data.followingSince ? formatDateTimeRelative(data.followingSince) : "--"}</span>
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
              label="Call Time"
              tone="green"
              value={data.callTime != null ? data.callTime.toString() : "--"}
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
          />
        </div>
        <div className={styles.adultBalanceArea}>
          {data.is18 && <NormalButton type="nobg" className={styles.grayBtn} text={!showAdultBalanceDetails ? "View Details" : "Hide Details"} onClick={
            () => { setShowAdultBalanceDetails((prev) => !prev) }
          } />
          }
          {showAdultBalanceDetails && (<div className={styles.adultBalanceStats}>
            <UsageView
              label="Voice Minutes"
              tone="purple"
              value={data.callTime != null ? data.callTime.toString() : "--"}
            />
            <UsageView
              label="Text Msg"
              tone="purple"
              value={data.msgRemaining != null ? data.msgRemaining.toString() : "--"}
            />
          </div>)}
          {showAdultBalanceDetails && <button className={styles.cancelSub} type="button" onClick={() => { setShowCancelModal(true) }}>Cancel Subscription</button>}
          <div className={styles.adultToggleArea}>
            <button type="button" className={styles.adultToggleBtn}>
              <span className={styles.adultText}>{data.adultCallTime ?? "0"} mins</span>
              <AdultModeToggle checked={adultModeChecked} onChange={handleAdultToggleChange} />
            </button>
            <p>Until {data.expiresAt}</p>
          </div>
        </div>
      </div>

      {/* Relationship stats area */}
      <div className={styles.relationshipArea}>
        <div className={styles.relationshipHeader}>
          <div className={styles.relationshipTitle}>Relationship Statistics</div>
        </div>
        <div className={styles.progressBar}>
          <ProgressBar mutedLabel label="Relationship Stage Progress" value={data.stageScore ?? 0} max={100} />
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

      <div className={styles.unfollow}>
        <IconButton color="black" type="pill" leftIcon={<SvgPack.Delete />} text={`Unfollow ${data.name}`} redText className={styles.unfollowBtn} />
      </div>

      {loading && <div className={styles.loading}>Loading…</div>}
      {showCancelModal && (
        <Modal isOpen={showCancelModal} onClose={() => {
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
                {cancelError && <div className={styles.modalError}>{cancelError}</div>}
                <div className={styles.modalActions}>
                  <NormalButton type="nobg" onClick={() => setShowCancelModal(false)} text="Cancel" />
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
      {/* Temporary loading to avoid  warning */}
      {loading && <div> </div>}

    </div>
  );
}
