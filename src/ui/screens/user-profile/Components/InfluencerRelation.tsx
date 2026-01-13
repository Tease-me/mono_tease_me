import { useEffect, useMemo, useState } from "react";
import clsx from "clsx";
import styles from "./InfluencerRelation.module.css";
import SvgPack from "@/utils/SvgPack";
import { RelationshipServices } from "@/api/services/RelationshipServices";
import { BalanceServices } from "@/api/services/BalanceServices";
import { apiClient } from "@/api/apis";
import ProfileMedia from "@/ui/components/ProfileMedia";
import RelationshipRadar from "@/ui/components/visualizations/RelationshipRadart";

const relationshipService = RelationshipServices(apiClient);
const balanceService = BalanceServices(apiClient);

type NavPayload = Record<string, any>;
type Props = {
  goBack: () => void;
  navPayload: NavPayload;
  goTo?: (id: string, payload?: NavPayload) => void;
};

type RelationData = {
  id?: string;
  name?: string;
  image?: string;
  lastConnected?: string | null;
  followingSince?: string | null;
  subscriptionStatus?: string | null;
  balance?: number;
  trust?: number;
  safety?: number;
  attraction?: number;
  closeness?: number;
  stageScore?: number;
};


export default function InfluencerRelation({ goBack, navPayload }: Props) {
  const initial: RelationData = useMemo(
    () => ({
      id: navPayload.influencerId,
      name: navPayload.name,
      image: navPayload.image,
      lastConnected: navPayload.lastConnected,
      followingSince: navPayload.followingSince,
      subscriptionStatus: navPayload.subscriptionStatus,
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

  // Fetch only if something important is missing
  useEffect(() => {
    if (!initial.id) return;
    const needsDetails =
      data.balance === undefined ||
      data.trust === undefined ||
      data.safety === undefined ||
      data.attraction === undefined ||
      data.closeness === undefined ||
      data.stageScore === undefined;

    if (!needsDetails) return;

    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const [rel, bal] = await Promise.all([
          relationshipService.getRelationship(initial.id!),
          balanceService.getBalance(initial.id!).catch(() => null),
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
            subscriptionStatus: rel.state,
            balance: bal ? bal.balance_cents / 100 : d.balance,
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

  return (
    <div className={styles.shell}>
      {/* Hero row: avatar + subscription */}
      <div className={styles.heroRow}>
        <ProfileMedia imageSrc={data.image} mediaType="image" size="large" />
        <div className={styles.heroInfo}>
          <div className={styles.badges}>
            <span className={styles.modeBadge}>18+ Mode</span>
            <span className={clsx(styles.statusBadge, styles.subscribed)}>
              {data.subscriptionStatus ?? "Subscribed"}
            </span>
          </div>
          <div className={styles.meta}>
            <span>Last Connected: <strong>{data.lastConnected ?? "--"}</strong></span>
            <span>Following Since {data.followingSince ?? "--"}</span>
          </div>
        </div>
      </div>

      {/* Balance & actions (skeleton) */}
      <div className={styles.balanceCard}>
        <div className={styles.balanceTag}>
          ${data.balance?.toFixed(2) ?? "0.00"}
        </div>
        <button className={styles.detailsPill}>View Details</button>
        <button className={styles.addCredit}>+ Add Credit</button>
        <button className={styles.detailsPill}>View Details</button>
        <div className={styles.toggleRow}>
          <button className={styles.toggleChip}>Lips</button>
          <button className={clsx(styles.toggleChip, styles.active)}>18+</button>
          <span className={styles.until}>Until --/--/--</span>
        </div>
      </div>

      {/* Relationship stats */}
      <div className={styles.statsBlock}>
        <div className={styles.statsHeader}>
          <div>
            <div className={styles.statsTitle}>Relationship Statistics</div>
            <div className={styles.statsSubtitle}>Relationship Stage Progress</div>
          </div>
          <div className={styles.statsScore}>{data.stageScore ?? 0}/100</div>
        </div>
        <div className={styles.progressBar}>
          <div
            className={styles.progressFill}
            style={{ width: `${Math.min(data.stageScore ?? 0, 100)}%` }}
          />
        </div>
        <div className={styles.stageLabels}>
          <span>Strangers</span>
          <span>Talking</span>
        </div>

        <RelationshipRadar
          trust={data.trust ?? 0}
          closeness={data.closeness ?? 0}
          attraction={data.attraction ?? 0}
          safety={data.safety ?? 0}
          height={280}
        />

        {/* TODO: radar chart */}
        <div className={styles.radarPlaceholder}>Radar chart here</div>

        <div className={styles.metricRow}>
          <span>Trust</span>
          <span>{data.trust ?? 0}</span>
          <div className={styles.metricBar}>
            <div style={{ width: `${Math.min(data.trust ?? 0, 100)}%` }} />
          </div>
        </div>
        <div className={styles.metricRow}>
          <span>Closeness</span>
          <span>{data.closeness ?? 0}</span>
          <div className={styles.metricBar}>
            <div style={{ width: `${Math.min(data.closeness ?? 0, 100)}%` }} />
          </div>
        </div>
        <div className={styles.metricRow}>
          <span>Attraction</span>
          <span>{data.attraction ?? 0}</span>
          <div className={styles.metricBar}>
            <div style={{ width: `${Math.min(data.attraction ?? 0, 100)}%` }} />
          </div>
        </div>
      </div>

      {loading && <div className={styles.loading}>Loading…</div>}
    </div>
  );
}
