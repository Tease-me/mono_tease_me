import { Suspense, useEffect, useMemo, useState } from "react";
import clsx from "clsx";
import styles from "./InfluencerRelation.module.css";
import SvgPack from "@/utils/SvgPack";
import { apiClient } from "@/api/apis";
import UsageView from "@/ui/components/stats/UsageView";
import PrimaryButton from "@/ui/components/inputs/buttons/PrimaryButton";
import NormalButton from "@/ui/components/inputs/buttons/NormalButton";
import BalanceBadge from "@/ui/components/stats/BalanceBadge";
import { Modal } from "@/ui/components/modals/Modal";
import { formatDateTimeRelative, minutesToTime } from "@/utils/DateTimeUtils";
import InfluencerProfileCard from "@/ui/components/profile/InfluencerProfileCard";

import { SubscriptionsServices } from "@/api/services/SubscriptionsServices";
import { BalanceServices } from "@/api/services/BalanceServices";
import { UserServices } from "@/api/services/UserServices";
import { InfluencerRepo } from "@/data/repositories/InfluencerRepo";
import { FollowServices } from "@/api/services/FollowServices";
import LoadingSpinner from "@/ui/components/loading/LoadingSpinner";
import { LatestAdultCallSummary } from "@/api/models/user";

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
  balance?: number;
  voiceMinutes?: number;
  msgRemaining?: number;
  lastCallMinutes?: number;
  lastCallSeconds?: number;
  lastCallUnitPriceCents?: number;
  latestAdultCallSummary?: LatestAdultCallSummary | null;
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
    }),
    [navPayload],
  );

  const [data, setData] = useState<RelationData>(initial);
  const [loading, setLoading] = useState(false);

  const [showBalanceDetails, setShowBalanceDetails] = useState(false);
  const [showCallInfoModal, setShowCallInfoModal] = useState(false);

  useEffect(() => {
    if (!initial.id) return;
    let cancelled = false;
    setLoading(true);

    (async () => {
      try {
        const [bal, sub, u, i, following] = await Promise.all([
          balanceService.getBalance(initial.id!, false).catch(() => null),
          subscriptionService.getMySubscriptionForInfluencer(initial.id!),
          userServices.getUserUsage(initial.id).catch(() => null),
          influencerRepo.getInfluencer(initial.id!),
          followingService.list(),
        ]);

        if (cancelled) return;
        const isAdultMode = sub?.is_18_selected === true;
        setData((d) => ({
          ...d,
          id: initial.id,
          image: i?.img,
          video: i?.videoUrl,
          name: i?.name,
          followingSince:
            following.items.find((f) => f.influencer_id === initial.id)
              ?.created_at ?? d.followingSince,
          balance: bal ? bal.balance_cents / 100 : d.balance,
          hasSubscription: sub?.has_subscription ?? d.hasSubscription,
          subscriptionStatus: sub?.status ?? d.subscriptionStatus,
          is18: sub?.is_18_selected ?? d.is18,
          expiresAt: sub?.current_period_end ?? d.expiresAt,
          voiceMinutes: isAdultMode
            ? (u?.free_allowances?.adult?.voice_free_left_minutes ?? 0) + (u?.adult?.voice?.remaining_minutes ?? d.voiceMinutes ?? 0)
            : u?.normal?.live_chat != null
              ? (u?.free_allowances?.normal?.live_chat_free_left_minutes ?? 0) + (u.normal.live_chat.remaining_minutes ?? 0)
              : d.voiceMinutes,
          msgRemaining: isAdultMode
            ? (u?.free_allowances?.adult?.text_free_left ?? 0) + (u?.adult?.messages?.remaining ?? d.msgRemaining ?? 0)
            : u?.normal?.messages != null
              ? (u?.free_allowances?.normal?.text_free_left ?? 0) + (u.normal.messages.remaining ?? 0)
              : d.msgRemaining,
          lastCallMinutes: isAdultMode
            ? (u?.adult?.voice?.last_call_minutes ?? d.lastCallMinutes)
            : (u?.normal?.live_chat?.last_call_minutes ?? d.lastCallMinutes),
          lastCallSeconds: isAdultMode
            ? (u?.adult?.voice?.last_call_seconds ?? d.lastCallSeconds)
            : (u?.normal?.live_chat?.last_call_seconds ?? d.lastCallSeconds),
          lastCallUnitPriceCents: isAdultMode
            ? (u?.adult?.voice?.unit_price_cents ?? d.lastCallUnitPriceCents)
            : (u?.normal?.live_chat?.unit_price_cents ?? d.lastCallUnitPriceCents),
          latestAdultCallSummary: u?.latest_adult_call_summary ?? null,
        }));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [initial.id]);

  // ── Live refresh: re-fetch usage when a call is billed ────
  useEffect(() => {
    if (!initial.id) return;
    const handler = async (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.type !== "call_billed") return;

      try {
        const u = await userServices.getUserUsage(initial.id).catch(() => null);
        if (!u) return;
        setData((d) => {
          const isAdultMode = d.is18 === true;
          return {
            ...d,
            balance: detail.balance_cents != null ? detail.balance_cents / 100 : d.balance,
            voiceMinutes: isAdultMode
              ? (u.free_allowances?.adult?.voice_free_left_minutes ?? 0) + (u.adult?.voice?.remaining_minutes ?? 0)
              : u.normal?.live_chat != null
                ? (u.free_allowances?.normal?.live_chat_free_left_minutes ?? 0) + (u.normal.live_chat.remaining_minutes ?? 0)
                : d.voiceMinutes,
            msgRemaining: isAdultMode
              ? (u.free_allowances?.adult?.text_free_left ?? 0) + (u.adult?.messages?.remaining ?? 0)
              : u.normal?.messages != null
                ? (u.free_allowances?.normal?.text_free_left ?? 0) + (u.normal.messages.remaining ?? 0)
                : d.msgRemaining,
            lastCallMinutes: isAdultMode
              ? (u.adult?.voice?.last_call_minutes ?? d.lastCallMinutes)
              : (u.normal?.live_chat?.last_call_minutes ?? d.lastCallMinutes),
            lastCallSeconds: isAdultMode
              ? (u.adult?.voice?.last_call_seconds ?? d.lastCallSeconds)
              : (u.normal?.live_chat?.last_call_seconds ?? d.lastCallSeconds),
            lastCallUnitPriceCents: isAdultMode
              ? (u.adult?.voice?.unit_price_cents ?? d.lastCallUnitPriceCents)
              : (u.normal?.live_chat?.unit_price_cents ?? d.lastCallUnitPriceCents),
            latestAdultCallSummary: u.latest_adult_call_summary ?? d.latestAdultCallSummary,
          };
        });
      } catch { /* silent — stale data is acceptable as fallback */ }
    };

    window.addEventListener("ws:notification", handler);
    return () => window.removeEventListener("ws:notification", handler);
  }, [initial.id]);

  const isSubscribed =
    !!data.hasSubscription && data.subscriptionStatus === "active";

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



  const handleAddCredits = () => {
    goTo("add_credits", { id: data.id, image: data.image, video: data.video });
  };

  const followingDate =
    data.followingSince && !Number.isNaN(Date.parse(data.followingSince))
      ? new Date(data.followingSince).toLocaleDateString()
      : "--";

  const latestAdultCallDuration = (() => {
    const seconds = data.latestAdultCallSummary?.duration_seconds;
    if (seconds == null) {
      return "--";
    }
    const total = Math.round(seconds);
    const mins = Math.floor(total / 60);
    const secs = total % 60;
    return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
  })();

  const latestAdultCallCost = data.latestAdultCallSummary?.cost_cents == null
    ? "--"
    : `$${(data.latestAdultCallSummary.cost_cents / 100).toFixed(2)}`;

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
                {data.latestAdultCallSummary && (
                  <div className={styles.lastCallSection}>
                    <div className={styles.lastCallHeader}>
                      <span className={styles.lastCallTitle}>
                        <Suspense fallback={null}><SvgPack.Call2 /></Suspense>
                        Last call details
                      </span>
                      <span className={styles.infoIconBtn} onClick={() => setShowCallInfoModal(true)}>
                        <Suspense fallback={null}><SvgPack.InfoCircleGray /></Suspense>
                      </span>
                    </div>
                    <div className={styles.lastCallStats}>
                      <div className={styles.lastCallCard}>
                        <span className={styles.lastCallCardLabel}>Duration</span>
                        <span className={styles.lastCallCardValue}>
                          {latestAdultCallDuration}
                        </span>
                      </div>
                      <div className={styles.lastCallCard}>
                        <span className={styles.lastCallCardLabel}>Cost</span>
                        <span className={styles.lastCallCardValue}>
                          {latestAdultCallCost}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
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
      </div>


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

    </div>
  );
}
