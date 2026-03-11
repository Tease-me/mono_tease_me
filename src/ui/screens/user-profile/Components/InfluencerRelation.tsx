import { Suspense, useEffect, useMemo, useState } from "react";
import clsx from "clsx";
import styles from "./InfluencerRelation.module.css";
import SvgPack from "@/utils/SvgPack";
import { apiClient } from "@/api/apis";
import RelationshipRadar from "@/ui/components/visualizations/RelationshipRadart";
import UsageView from "@/ui/components/stats/UsageView";
import PrimaryButton from "@/ui/components/inputs/buttons/PrimaryButton";
import NormalButton from "@/ui/components/inputs/buttons/NormalButton";
import IconButton from "@/ui/components/inputs/buttons/IconButton";
import BalanceBadge from "@/ui/components/stats/BalanceBadge";
import AdultModeToggle from "@/ui/components/adult-mode-toggle/AdultModeToggle";
import { Modal } from "@/ui/components/modals/Modal";
import { formatDateTimeRelative, minutesToTime } from "@/utils/DateTimeUtils";
import RelationshipStageProgress from "@/ui/components/stats/RelationshipStageProgress";
import RelatioshipAffinities from "@/ui/components/stats/RelatioshipAffinities";
import InfluencerProfileCard from "@/ui/components/profile/InfluencerProfileCard";

import { SubscriptionsServices } from "@/api/services/SubscriptionsServices";
import { RelationshipServices } from "@/api/services/RelationshipServices";
import { BalanceServices } from "@/api/services/BalanceServices";
import { UserServices } from "@/api/services/UserServices";
import logger from "@/utils/logger";
import TextInput from "@/ui/components/inputs/text-inputs/TextInput";
import AdultTermsModal from "@/ui/components/modals/adult-terms/AdultTermsModal";
import { InfluencerRepo } from "@/data/repositories/InfluencerRepo";
import { FollowServices } from "@/api/services/FollowServices";
import { ADULT_MODE_AVAILABLE } from "@/constants/adultModeAvailable";
import LoadingSpinner from "@/ui/components/loading/LoadingSpinner";
//TODO
// UNFOLLOW BUTTON IS HIDDEN
//CHECK STATUS OF SUBSCRIPTION IF CANCELLED OR REACTIVATED ETC

const relationshipService = RelationshipServices(apiClient);
const balanceService = BalanceServices(apiClient);
const subscriptionService = SubscriptionsServices(apiClient);
const userServices = UserServices(apiClient);
const influencerRepo = InfluencerRepo();

const followingService = FollowServices(apiClient);

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
  msgRemaining?: number;
  lastCallMinutes?: number;
  lastCallSeconds?: number;
  lastCallUnitPriceCents?: number;
  //18+ Data
  adultBalance?: number;
  adultVoiceMinutes?: number;
  adultMsgRemaining?: number;
  //Love stats
  trust?: number;
  safety?: number;
  attraction?: number;
  closeness?: number;
  sentimentScore?: number;
  //Stage dimensions
  currentStage?: string;
  nextStage?: string;
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
      sentimentScore: navPayload.sentimentScore,
      state: navPayload.status,
    }),
    [navPayload],
  );

  const [data, setData] = useState<RelationData>(initial);
  const [loading, setLoading] = useState(false);

  const [showBalanceDetails, setShowBalanceDetails] = useState(false);
  const [showAdultBalanceDetails, setShowAdultBalanceDetails] = useState(false);
  const [adultModeChecked, setAdultModeChecked] = useState(
    !!data.hasSubscription && data.subscriptionStatus === "active",
  );

  const [showCallInfoModal, setShowCallInfoModal] = useState(false);
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
        const [rel, bal, sub, u, i, following, dims] = await Promise.all([
          relationshipService.getRelationship(initial.id!),
          balanceService.getBalance(initial.id!, false).catch(() => null),
          subscriptionService.getMySubscriptionForInfluencer(initial.id!),
          userServices.getUserUsage(initial.id).catch(() => null),
          influencerRepo.getInfluencer(initial.id!),
          followingService.list(),
          relationshipService.getDimensions(initial.id!).catch(() => null),
        ]);

        if (cancelled) return;
        setData((d) => ({
          ...d,
          id: initial.id,
          image: i?.img,
          video: i?.videoUrl,
          name: i?.name,
          followingSince:
            following.items.find((f) => f.influencer_id === initial.id)
              ?.created_at ?? d.followingSince,
          trust: rel?.trust ?? d.trust,
          safety: rel?.safety ?? d.safety,
          attraction: rel?.attraction ?? d.attraction,
          closeness: rel?.closeness ?? d.closeness,
          sentimentScore: rel?.sentiment_score ?? d.sentimentScore,
          lastConnected: rel?.last_interaction_at ?? d.lastConnected,
          balance: bal ? bal.balance_cents / 100 : d.balance,
          hasSubscription: sub?.has_subscription ?? d.hasSubscription,
          subscriptionStatus: sub?.status ?? d.subscriptionStatus,
          is18: sub?.is_18_selected ?? d.is18,
          expiresAt: sub?.current_period_end ?? d.expiresAt,
          voiceMinutes:
            u?.normal?.live_chat != null
              ? (u?.free_allowances?.normal?.live_chat_free_left_minutes ?? 0) + (u.normal.live_chat.remaining_minutes ?? 0)
              : d.voiceMinutes,
          msgRemaining:
            u?.normal?.messages != null
              ? (u?.free_allowances?.normal?.text_free_left ?? 0) + (u.normal.messages.remaining ?? 0)
              : d.msgRemaining,
          lastCallMinutes: u?.normal?.live_chat?.last_call_minutes ?? d.lastCallMinutes,
          lastCallSeconds: u?.normal?.live_chat?.last_call_seconds ?? d.lastCallSeconds,
          lastCallUnitPriceCents: u?.normal?.live_chat?.unit_price_cents ?? d.lastCallUnitPriceCents,
          adultVoiceMinutes:
            u?.adult?.voice != null
              ? (u?.free_allowances?.adult?.voice_free_left_minutes ?? 0) + (u.adult.voice.remaining_minutes ?? 0)
              : d.adultVoiceMinutes,
          adultMsgRemaining:
            u?.adult?.messages != null
              ? (u?.free_allowances?.adult?.text_free_left ?? 0) + (u.adult.messages.remaining ?? 0)
              : d.adultMsgRemaining,
          currentStage: dims?.current_stage ?? d.currentStage,
          nextStage: dims?.next_stage ?? d.nextStage,
        }));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [initial.id]);

  const isSubscribed =
    !!data.hasSubscription && data.subscriptionStatus === "active";

  useEffect(() => {
    setAdultModeChecked(isSubscribed);
  }, [isSubscribed]);

  //Navpayload
  useEffect(() => {
    if (!navPayload.influencerId) return;
    setLoading(true);
    setData((d) => ({
      ...d,
      id: navPayload.influencerId,
      image: undefined,
      video: undefined,
      name: undefined,
    }));
  }, [
    navPayload.influencerId,
  ]);

  const goToSubPage = () => {
    goTo("subscribe", {
      influencerId: data.id,
      influencerImageUrl: data.image,
      influencerName: data.name,
      onSubscribe: () =>
        goTo("subscription", {
          influencerId: data.id,
        }),
    });
  };

  const handleAdultToggleChange = async () => {
    if (!ADULT_MODE_AVAILABLE) {
      goToSubPage();
      return;
    }
    if (!isSubscribed) {
      //Check if verified
      try {
        await subscriptionService.activateMySubscriptionForInfluencer(
          data.id,
          true,
        );
        goToSubPage();
      } catch (err: any) {
        const idVerified =
          err?.response?.data?.detail?.verification_status
            ?.is_identity_verified;
        if (idVerified === false) {
          setShowTermsModal(true);
          return;
        }
        goToSubPage();
      }
    } else {
      setShowCancelModal(true);
    }
  };

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
      setData((d) => ({
        ...d,
        hasSubscription: false,
        subscriptionStatus: "cancelled",
      }));
      setAdultModeChecked(false);
      setShowAdultBalanceDetails(false);
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
  };

  const followingDate =
    data.followingSince && !Number.isNaN(Date.parse(data.followingSince))
      ? new Date(data.followingSince).toLocaleDateString()
      : "--";

  const onAdultTermsAgreed = () => { };

  if (loading) {
    return (
      <div className={styles.loading}>
        {" "}
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className={clsx("u-sidebar-page", styles.shell)}>
      <InfluencerProfileCard
        name={data.name || ""}
        image={data.image || ""}
        video={data.video}
        isSubscribed={isSubscribed}
        lastConnected={
          data.lastConnected ? formatDateTimeRelative(data.lastConnected) : "--"
        }
        followingSince={followingDate}
      />

      {/* Balance Card */}
      <div className={styles.balanceCard}>
        <div className={styles.balanceArea}>
          <div className={styles.balanceBadge}>
            <BalanceBadge balance={data.balance ? data.balance : 0} />
          </div>
          <NormalButton
            type="nobg"
            className={styles.grayBtn}
            text={!showBalanceDetails ? "View Details" : "Hide Details"}
            onClick={() => setShowBalanceDetails((prev) => !prev)}
          />
          {showBalanceDetails && (
            <>
              <div className={styles.balanceStatsWrapper}>
                <p className={styles.totalBalanceLabel}>Remaining usage (estimate) </p>
                <div className={styles.balanceStats}>
                  <UsageView
                    label="Call Time"
                    tone="green"
                    value={
                      data.voiceMinutes != null
                        ? minutesToTime(data.voiceMinutes)
                        : "--"
                    }
                  />
                  <UsageView
                    label="Text Msgs"
                    tone="green"
                    value={
                      data.msgRemaining != null
                        ? data.msgRemaining.toString()
                        : "--"
                    }
                  />
                </div>
                <div className={styles.lastCallSection}>
                  <div className={styles.lastCallHeader}>
                    <span className={styles.lastCallTitle}>
                      <Suspense fallback={null}><SvgPack.Call2 /></Suspense>
                      Last Call Details
                    </span>
                    <span className={styles.infoIconBtn} onClick={() => setShowCallInfoModal(true)}>
                      <Suspense fallback={null}><SvgPack.InfoCircleGray /></Suspense>
                    </span>
                  </div>
                  <div className={styles.lastCallStats}>
                    <div className={styles.lastCallCard}>
                      <span className={styles.lastCallCardLabel}>Duration</span>
                      <span className={styles.lastCallCardValue}>
                        {data.lastCallMinutes != null ? minutesToTime(data.lastCallMinutes) : "--"}
                      </span>
                    </div>
                    <div className={styles.lastCallCard}>
                      <span className={styles.lastCallCardLabel}>Cost</span>
                      <span className={styles.lastCallCardValue}>
                        {data.lastCallSeconds != null && data.lastCallUnitPriceCents != null
                          ? `$${((data.lastCallSeconds * data.lastCallUnitPriceCents) / 100).toFixed(2)}`
                          : "--"}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}
          <PrimaryButton
            leftIcon={<SvgPack.PlusBox />}
            text="Add Credit"
            onClick={handleAddCredits}
            className={styles.btn}
          />
        </div>
        <div className={styles.adultBalanceArea}>
          <div className={styles.adultBalanceInner}>
            {ADULT_MODE_AVAILABLE && (
              <>
                <NormalButton
                  type="nobg"
                  className={styles.grayBtn}
                  text={!showAdultBalanceDetails ? "View Details" : "Hide Details"}
                  onClick={() => setShowAdultBalanceDetails((prev) => !prev)}
                />
                {showAdultBalanceDetails && (
                  <div className={styles.adultBalanceStats}>
                    <UsageView
                      label="Voice Minutes"
                      tone="purple"
                      value={
                        data.adultVoiceMinutes != null
                          ? minutesToTime(data.adultVoiceMinutes)
                          : "--"
                      }
                    />
                    <UsageView
                      label="Text Msg"
                      tone="purple"
                      value={
                        data.adultMsgRemaining != null
                          ? data.adultMsgRemaining.toString()
                          : "--"
                      }
                    />
                  </div>
                )}
                {isSubscribed && showAdultBalanceDetails && (
                  <button
                    className={styles.cancelSub}
                    type="button"
                    onClick={() => setShowCancelModal(true)}
                  >
                    Cancel Subscription
                  </button>
                )}
              </>
            )}
            <div className={styles.adultToggleArea}>
              <button type="button" className={styles.adultToggleBtn}>
                <AdultModeToggle
                  checked={adultModeChecked}
                  onChange={handleAdultToggleChange}
                  minutesLeft={data.adultVoiceMinutes}
                />
              </button>
              {ADULT_MODE_AVAILABLE && isSubscribed && (
                <p>
                  Until:{" "}
                  {data.expiresAt
                    ? new Date(data.expiresAt).toLocaleDateString()
                    : "--"}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Relationship stats area */}
      <div className={styles.relationshipArea}>
        <div className={styles.relationshipHeader}>
          <div className={styles.relationshipTitle}>
            Relationship Statistics
          </div>
        </div>
        {data.currentStage && (
          <RelationshipStageProgress
            sentimentScore={data.sentimentScore ?? 0}
            large
            currentStage={data.currentStage}
            nextStage={data.nextStage}
          />
        )}

        {/*  radar chart */}
        <div className={styles.radarPlaceholder}>
          <RelationshipRadar
            trust={data.trust ?? 0}
            closeness={data.closeness ?? 0}
            attraction={data.attraction ?? 0}
            safety={data.safety ?? 0}
            height={280}
            width={320}
          />
        </div>
      </div>

      <div className={styles.relationshipStatsArea}>
        <RelatioshipAffinities
          trust={data.trust ?? 0}
          closeness={data.closeness ?? 0}
          attraction={data.attraction ?? 0}
          safety={data.safety ?? 0}
        />
      </div>

      {/* <div className={styles.unfollow}>
        <IconButton color="black" type="pill" leftIcon={<SvgPack.Delete />} text={`Unfollow ${data.name}`} redText className={styles.unfollowBtn} />
      </div> */}

      {showCallInfoModal && (
        <Modal isOpen onClose={() => setShowCallInfoModal(false)} className={styles.callInfoModal}>
          <div className={styles.callInfoModalCard}>
            <h3 className={styles.callInfoHeading}>How are call costs calculated?</h3>
            <p className={styles.callInfoSubtitle}>Standard call charge $1.00 – $1.30 per minute</p>
            <div className={styles.callInfoNote}>
              <p className={styles.callInfoNoteTitle}>Notes on Call Charges</p>
              <p className={styles.callInfoNoteText}>The total duration of the connection.<br></br> Includes the time it takes to establish the connection and is usually longer than the conversation.</p>
            </div>
          </div>
        </Modal>
      )}

      {showCancelModal && (
        <Modal
          isOpen={showCancelModal}
          onClose={() => {
            setCancelError("");
            setShowCancelModal(false);
            setCancelSuccess(false);
            setCancelError(null);
          }}
          className={styles.cancelModal}
        >
          <div className={styles.modalCard}>
            {!cancelSuccess ? (
              <>
                <h3>Cancel 18+ subscription?</h3>
                <p>
                  Upon cancelling, you will no longer be able to have explicit
                  conversation with {data.name}.
                </p>
                <TextInput
                  type="text"
                  placeholder="Reason for canceling"
                  value={cancelReason}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    setCancelReason(e.target.value)
                  }
                />
                {cancelError && (
                  <div className={styles.modalError}>{cancelError}</div>
                )}
                <div className={styles.modalActions}>
                  <NormalButton
                    type="nobg"
                    onClick={() => {
                      setCancelError("");
                      setShowCancelModal(false);
                      setCancelSuccess(false);
                      setCancelError(null);
                    }}
                    text="Cancel"
                  />
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
      <AdultTermsModal
        isOpen={showTermsModal}
        onClose={() => setShowTermsModal(false)}
        onAgree={onAdultTermsAgreed}
        influencerId={data.id}
        influencerName={data.name}
        influencerImageUrl={data.image}
      />
    </div>
  );
}
