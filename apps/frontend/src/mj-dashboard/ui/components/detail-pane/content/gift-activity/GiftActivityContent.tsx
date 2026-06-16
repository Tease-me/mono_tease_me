import React, { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import clsx from "clsx";
import styles from "./GiftActivityContent.module.css";
import { apiClient } from "@/api/apis";
import {
  GiftActivityItem,
  GiftActivityServices,
} from "@/api/services/GiftActivityServices";
import SvgPack from "@/utils/SvgPack";
import BlockingLoader from "@/ui/components/loading/BlockingLoader";
import TextInput from "@/ui/components/inputs/text-inputs/TextInput";

const giftActivityService = GiftActivityServices(apiClient);

const formatMoney = (cents: number): string => `$${(cents / 100).toFixed(2)}`;

const formatDate = (value: string | null): string => {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString(undefined, {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
};

type ActivityRowProps = {
  item: GiftActivityItem;
  expanded: boolean;
  onToggleExpand: () => void;
  onSendGift: (userId: number, influencerId: string) => Promise<void>;
  sending: boolean;
};

const ActivityRow: React.FC<ActivityRowProps> = ({
  item,
  expanded,
  onToggleExpand,
  onSendGift,
  sending,
}) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    if (!item.gift_code) return;
    await navigator.clipboard.writeText(item.gift_code);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  };

  const showFirstDeposit = item.is_first_deposit && item.gift_status !== "deposit";
  const showGiftButton = item.gift_status === "pending";
  const showGiftedBadge = item.gift_status === "sent";
  const showPromoPanel =
    expanded && item.gift_status === "sent" && Boolean(item.gift_code);

  return (
    <article className={styles.row}>
      <div className={styles.rowMain}>
        <div className={styles.userBlock}>
          <div className={styles.userName}>{item.name || "User"}</div>
          <div className={styles.userMeta}>{item.user_id}</div>
          <div className={styles.userEmail}>{item.email}</div>
          <div className={styles.userMeta}>
            {formatDate(item.date)} · Ref: {item.ref || "—"}
          </div>
        </div>

        <div className={styles.amountBlock}>
          <div className={styles.lifetime}>
            Lifetime <span>{formatMoney(item.lifetime_cents)}</span>
          </div>
          <div className={styles.lastDeposit}>{formatMoney(item.last_deposit_cents)}</div>
        </div>
      </div>

      <div className={styles.rowActions}>
        {showGiftButton && (
          <button
            type="button"
            className={styles.giftButton}
            disabled={sending}
            onClick={() => onSendGift(item.user_id, item.influencer_id)}
          >
            <span aria-hidden="true">🎁</span> Gift
          </button>
        )}

        {showGiftedBadge && (
          <button
            type="button"
            className={styles.giftedBadge}
            onClick={onToggleExpand}
          >
            Gifted!
          </button>
        )}

        {showFirstDeposit && (
          <div className={styles.firstDepositBadge}>
            <Suspense fallback={null}>
              <SvgPack.Star />
            </Suspense>
            1st Deposit
          </div>
        )}

        {item.gift_status === "accepted" && (
          <div className={styles.statusAccepted}>
            <Suspense fallback={null}>
              <SvgPack.TickSquare />
            </Suspense>
            Accepted
          </div>
        )}

        {item.gift_status === "expired" && (
          <div className={styles.statusExpired}>Expired</div>
        )}

        {item.gift_status === "deposit" && (
          <div className={styles.statusDeposit}>
            <Suspense fallback={null}>
              <SvgPack.PaymentTick />
            </Suspense>
            Deposit
          </div>
        )}
      </div>

      {showPromoPanel && (
        <div className={styles.promoPanel}>
          <div className={styles.promoTitle}>PROMO CODE</div>
          <p className={styles.promoDescription}>
            {item.diamonds ?? 120} diamonds. Redeem in Teaseme with this email only
          </p>
          <div className={styles.promoCodeBox}>{item.gift_code}</div>
          <button type="button" className={styles.copyButton} onClick={handleCopy}>
            {copied ? "Copied" : "Copy"}
          </button>
        </div>
      )}
    </article>
  );
};

const activityRowKey = (item: GiftActivityItem) =>
  `${item.user_id}:${item.influencer_id}`;

const GiftActivityContent: React.FC = () => {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [items, setItems] = useState<GiftActivityItem[]>([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedRowKey, setExpandedRowKey] = useState<string | null>(null);
  const [sendingRowKey, setSendingRowKey] = useState<string | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [search]);

  const loadActivity = useCallback(async (options?: { silent?: boolean }) => {
    if (!options?.silent) {
      setLoading(true);
    }
    setError(null);
    try {
      const response = await giftActivityService.getGiftActivity(
        debouncedSearch || undefined,
      );
      setItems(response.items);
      setPendingCount(response.pending_count);
    } catch {
      if (!options?.silent) {
        setError("Unable to load gift activity");
      }
    } finally {
      if (!options?.silent) {
        setLoading(false);
      }
    }
  }, [debouncedSearch]);

  useEffect(() => {
    void loadActivity();
  }, [loadActivity]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      void loadActivity({ silent: true });
    }, 10_000);
    return () => window.clearInterval(interval);
  }, [loadActivity]);

  const handleSendGift = async (userId: number, influencerId: string) => {
    const rowKey = `${userId}:${influencerId}`;
    setSendingRowKey(rowKey);
    try {
      const response = await giftActivityService.sendGift(userId, influencerId);
      setItems((prev) =>
        prev.map((item) =>
          item.user_id === userId && item.influencer_id === influencerId
            ? {
                ...item,
                gift_status: response.status,
                gift_code: response.code,
                diamonds: response.diamonds,
              }
            : item,
        ),
      );
      setExpandedRowKey(rowKey);
      setPendingCount((count) => Math.max(0, count - 1));
    } catch {
      setError("Unable to send gift");
    } finally {
      setSendingRowKey(null);
    }
  };

  const content = useMemo(() => {
    if (loading) {
      return (
        <div className={styles.loaderWrap}>
          <BlockingLoader />
        </div>
      );
    }

    if (error) {
      return <div className={styles.emptyState}>{error}</div>;
    }

    if (!items.length) {
      return <div className={styles.emptyState}>No activity found.</div>;
    }

    return items.map((item) => {
      const rowKey = activityRowKey(item);
      return (
        <ActivityRow
          key={rowKey}
          item={item}
          expanded={expandedRowKey === rowKey}
          onToggleExpand={() =>
            setExpandedRowKey((current) => (current === rowKey ? null : rowKey))
          }
          onSendGift={handleSendGift}
          sending={sendingRowKey === rowKey}
        />
      );
    });
  }, [error, expandedRowKey, items, loading, sendingRowKey]);

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={styles.filterLabel}>Filter by</div>
        <div className={styles.searchRow}>
          <TextInput
            className={styles.searchInput}
            placeholder="Name or Email"
            value={search}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              setSearch(e.target.value)
            }
            size="medium"
          />
          <div className={styles.giftBadge} aria-label={`${pendingCount} pending gifts`}>
            <span aria-hidden="true">🎁</span>
            {pendingCount > 0 && (
              <span className={styles.giftBadgeCount}>{pendingCount}</span>
            )}
          </div>
        </div>
      </div>

      <div className={styles.sectionTitle}>Activity</div>
      <div className={clsx(styles.list, loading && styles.listLoading)}>{content}</div>
    </div>
  );
};

export default GiftActivityContent;
