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
import { formatDateTimeRelative } from "@/utils/DateTimeUtils";
import InfluencerProfileCard from "@/ui/components/profile/InfluencerProfileCard";

import { SubscriptionsServices } from "@/api/services/SubscriptionsServices";
import {
  AdultCharacterSummary,
  BillingServices,
} from "@/api/services/BillingServices";
import { InfluencerRepo } from "@/data/repositories/InfluencerRepo";
import { FollowServices } from "@/api/services/FollowServices";
import LoadingSpinner from "@/ui/components/loading/LoadingSpinner";

const billingService = BillingServices(apiClient);
const subscriptionService = SubscriptionsServices(apiClient);
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
  estimatedRemainingCallSeconds?: number | null;
  msgRemaining?: number;
  latestAdultCallSummary?: AdultCharacterSummary["latest_adult_call_summary"];
};

function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

function formatSeconds(totalSeconds: number | null | undefined): string {
  if (totalSeconds == null) return "--";
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function formatDurationSeconds(totalSeconds: number | null | undefined): string {
  if (totalSeconds == null) return "--";
  return `${Math.round(totalSeconds)}s`;
}

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
        const [adultSummary, sub, i, following] = await Promise.all([
          billingService.getAdultCharacterSummary(initial.id!).catch(() => null),
          subscriptionService.getMySubscriptionForInfluencer(initial.id!),
          influencerRepo.getInfluencer(initial.id!),
          followingService.list(),
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
          balance:
            adultSummary?.balance_cents != null
              ? adultSummary.balance_cents / 100
              : d.balance,
          hasSubscription: sub?.has_subscription ?? d.hasSubscription,
          subscriptionStatus: sub?.status ?? d.subscriptionStatus,
          is18: sub?.is_18_selected ?? d.is18,
          expiresAt: sub?.current_period_end ?? d.expiresAt,
          estimatedRemainingCallSeconds:
            adultSummary?.estimated_remaining_call_seconds ?? null,
          latestAdultCallSummary:
            adultSummary?.latest_adult_call_summary ?? null,
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
        const adultSummary = await billingService
          .getAdultCharacterSummary(initial.id)
          .catch(() => null);
        if (!adultSummary) return;
        setData((d) => {
          return {
            ...d,
            balance:
              adultSummary.balance_cents != null
                ? adultSummary.balance_cents / 100
                : detail.balance_cents != null
                  ? detail.balance_cents / 100
                  : d.balance,
            estimatedRemainingCallSeconds:
              adultSummary.estimated_remaining_call_seconds,
            latestAdultCallSummary:
              adultSummary.latest_adult_call_summary ?? d.latestAdultCallSummary,
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
    return formatDurationSeconds(
      data.latestAdultCallSummary?.duration_seconds ?? null
    );
  })();

  const latestAdultCallCost = data.latestAdultCallSummary?.cost_cents == null
    ? "--"
    : formatCents(data.latestAdultCallSummary.cost_cents);

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
                    value={formatSeconds(data.estimatedRemainingCallSeconds)}
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
