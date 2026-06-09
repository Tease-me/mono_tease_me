import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
    Bar,
    BarChart,
    CartesianGrid,
    Cell,
    Line,
    LineChart,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from "recharts";

import { apiClient } from "@/api/apis";
import {
    AdminServices,
    AnalyticsOverview,
    UserGrowthResponse,
    UserEngagementResponse,
    UserSpendingResponse,
    UserRetentionResponse,
    UserDetailResponse,
} from "@/api/services/AdminServices";
import styles from "./UserAnalytics.module.css";

const admin = AdminServices(apiClient);

type Period = "1h" | "24h" | "7d" | "30d" | "90d";

const PERIOD_OPTIONS: { value: Period; label: string }[] = [
    { value: "1h", label: "Last 1 hour" },
    { value: "24h", label: "Last 24 hours" },
    { value: "7d", label: "Last 7 days" },
    { value: "30d", label: "Last 30 days" },
    { value: "90d", label: "Last 90 days" },
];

const BAR_COLORS = [
    "#00A9F1", "#A855F7", "#4ADE80", "#FB7185",
    "#FACC15", "#F97316", "#06B6D4", "#E879F9",
    "#34D399", "#F472B6",
];

/* ── Helpers ────────────────────────────────────────────── */

function fmtNum(n: number | null | undefined): string {
    if (n == null) return "0";
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
    return n.toLocaleString();
}

function fmtCost(usd: number | null | undefined): string {
    if (usd == null || usd === 0) return "$0.00";
    if (usd < 0.01) return `$${usd.toFixed(6)}`;
    if (usd < 1) return `$${usd.toFixed(4)}`;
    return `$${usd.toFixed(2)}`;
}

function fmtDuration(secs: number | null | undefined): string {
    if (secs == null || secs === 0) return "—";
    if (secs >= 3600) return `${(secs / 3600).toFixed(1)}h`;
    if (secs >= 60) return `${(secs / 60).toFixed(1)}m`;
    return `${Math.round(secs)}s`;
}

function fmtPct(n: number | null | undefined): string {
    if (n == null) return "0%";
    return `${(n * 100).toFixed(1)}%`;
}

function rankClass(i: number): string {
    if (i === 0) return styles["rank--gold"];
    if (i === 1) return styles["rank--silver"];
    if (i === 2) return styles["rank--bronze"];
    return styles["rank--default"];
}

/* ── Tooltip ────────────────────────────────────────────── */

const ChartTooltip: React.FC<any> = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;
    return (
        <div
            style={{
                background: "rgba(15,18,26,0.95)",
                border: "1px solid rgba(255,255,255,0.12)",
                borderRadius: 12,
                padding: "10px 14px",
                fontSize: 12,
            }}
        >
            <div style={{ fontWeight: 800, marginBottom: 4 }}>{label}</div>
            {payload.map((p: any) => (
                <div key={p.dataKey} style={{ color: p.stroke || p.fill, marginTop: 2 }}>
                    {p.name}: {fmtNum(p.value)}
                </div>
            ))}
        </div>
    );
};

/* ── User Detail Modal ──────────────────────────────────── */

const UserDetailModal: React.FC<{
    userId: number;
    onClose: () => void;
}> = ({ userId, onClose }) => {
    const [data, setData] = useState<UserDetailResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        setLoading(true);
        setError(null);
        admin
            .getUserDetail(userId)
            .then(setData)
            .catch((e: any) => setError(e?.response?.data?.detail || e?.message || "Failed"))
            .finally(() => setLoading(false));
    }, [userId]);

    return (
        <div className={styles["modal-backdrop"]} onClick={onClose}>
            <div className={styles["modal"]} onClick={(e) => e.stopPropagation()}>
                <div className={styles["modal-header"]}>
                    <div className={styles["modal-title"]}>User #{userId} — Detail</div>
                    <button className={styles["modal-close"]} onClick={onClose}>
                        ✕ Close
                    </button>
                </div>

                {loading && (
                    <div className={styles["loading"]}>
                        <div className={styles["spinner"]} />
                        Loading…
                    </div>
                )}
                {error && <div className={styles["error-banner"]}>⚠ {error}</div>}

                {data && (
                    <>
                        {/* Profile */}
                        <div className={styles["modal-section-title"]}>Profile</div>
                        <div className={styles["modal-grid"]}>
                            {Object.entries(data.profile).map(([k, v]) => (
                                <div key={k} className={styles["modal-stat"]}>
                                    <div className={styles["modal-stat__label"]}>{k.replace(/_/g, " ")}</div>
                                    <div className={styles["modal-stat__value"]}>
                                        {v == null ? "—" : String(v)}
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Activity */}
                        <div className={styles["modal-section-title"]}>Activity</div>
                        <div className={styles["modal-grid"]}>
                            <div className={styles["modal-stat"]}>
                                <div className={styles["modal-stat__label"]}>Messages</div>
                                <div className={styles["modal-stat__value"]}>{fmtNum(data.messages_count)}</div>
                            </div>
                            <div className={styles["modal-stat"]}>
                                <div className={styles["modal-stat__label"]}>Calls</div>
                                <div className={styles["modal-stat__value"]}>{fmtNum(data.calls_count)}</div>
                            </div>
                            <div className={styles["modal-stat"]}>
                                <div className={styles["modal-stat__label"]}>Call Duration</div>
                                <div className={styles["modal-stat__value"]}>{fmtDuration(data.total_call_duration_secs)}</div>
                            </div>
                            <div className={styles["modal-stat"]}>
                                <div className={styles["modal-stat__label"]}>Relationships</div>
                                <div className={styles["modal-stat__value"]}>{data.relationships?.length ?? 0}</div>
                            </div>
                        </div>

                        {/* Financial */}
                        <div className={styles["modal-section-title"]}>Financial</div>
                        <div className={styles["modal-grid"]}>
                            <div className={styles["modal-stat"]}>
                                <div className={styles["modal-stat__label"]}>Total Top-ups</div>
                                <div className={styles["modal-stat__value"]}>{fmtCost(data.total_topups_usd)}</div>
                            </div>
                            <div className={styles["modal-stat"]}>
                                <div className={styles["modal-stat__label"]}>API Cost</div>
                                <div className={styles["modal-stat__value"]}>{fmtCost(data.total_api_cost_usd)}</div>
                            </div>
                            <div className={styles["modal-stat"]}>
                                <div className={styles["modal-stat__label"]}>Active Subscriptions</div>
                                <div className={styles["modal-stat__value"]}>{data.subscriptions?.length ?? 0}</div>
                            </div>
                            <div className={styles["modal-stat"]}>
                                <div className={styles["modal-stat__label"]}>Violations</div>
                                <div className={styles["modal-stat__value"]}>{data.violations?.length ?? 0}</div>
                            </div>
                        </div>

                        {/* Wallets */}
                        {data.wallets?.length > 0 && (
                            <>
                                <div className={styles["modal-section-title"]}>Wallets</div>
                                <div className={styles["table-wrap"]}>
                                    <table className={styles["table"]}>
                                        <thead>
                                            <tr>
                                                <th>Influencer</th>
                                                <th>Balance</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {data.wallets.map((w: any, i: number) => (
                                                <tr key={i}>
                                                    <td data-label="Influencer">{w.influencer_id}</td>
                                                    <td data-label="Balance">{fmtCost(w.balance)}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </>
                        )}
                    </>
                )}
            </div>
        </div>
    );
};

/* ── Main Component ─────────────────────────────────────── */

const UserAnalytics: React.FC = () => {
    const [period, setPeriod] = useState<Period>("30d");
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const [overview, setOverview] = useState<AnalyticsOverview | null>(null);
    const [growth, setGrowth] = useState<UserGrowthResponse | null>(null);
    const [engagement, setEngagement] = useState<UserEngagementResponse | null>(null);
    const [spending, setSpending] = useState<UserSpendingResponse | null>(null);
    const [retention, setRetention] = useState<UserRetentionResponse | null>(null);

    const [detailUserId, setDetailUserId] = useState<number | null>(null);

    const fetchAll = useCallback(async () => {
        setLoading(true);
        setError(null);

        const [ov, gr, en, sp, re] = await Promise.allSettled([
            admin.getAnalyticsOverview(),
            admin.getUserGrowth(period),
            admin.getUserEngagement(period),
            admin.getUserSpending(period),
            admin.getUserRetention(period),
        ]);

        // Set whichever succeeded
        if (ov.status === "fulfilled") setOverview(ov.value);
        if (gr.status === "fulfilled") setGrowth(gr.value);
        if (en.status === "fulfilled") setEngagement(en.value);
        if (sp.status === "fulfilled") setSpending(sp.value);
        if (re.status === "fulfilled") setRetention(re.value);

        // Collect any errors
        const errors = [ov, gr, en, sp, re]
            .filter((r): r is PromiseRejectedResult => r.status === "rejected")
            .map((r) => r.reason?.response?.data?.detail || r.reason?.message || "Unknown error");

        if (errors.length === 5) {
            setError(errors[0]);
        } else if (errors.length > 0) {
            setError(`${errors.length} section(s) failed to load`);
        }

        setLoading(false);
    }, [period]);

    useEffect(() => {
        fetchAll();
    }, [fetchAll]);

    /* ── Chart data ─────────────────────────────────────── */

    const growthChartData = useMemo(
        () => growth?.daily_signups?.map((d) => ({ name: d.date, signups: d.count })) ?? [],
        [growth]
    );

    const retentionChartData = useMemo(
        () => retention?.daily_active_trend?.map((d) => ({ name: d.date, active: d.active })) ?? [],
        [retention]
    );

    const channelChartData = useMemo(() => {
        if (!engagement?.channel_breakdown) return [];
        return Object.entries(engagement.channel_breakdown).map(([name, count]) => ({
            name,
            count,
        }));
    }, [engagement]);

    return (
        <div className={styles["page"]}>
            {/* ── Toolbar ──────────────────────────────────────── */}
            <div className={styles["toolbar"]}>
                <div className={styles["toolbar-left"]}>
                    <select
                        className={styles["select"]}
                        value={period}
                        onChange={(e) => setPeriod(e.target.value as Period)}
                    >
                        {PERIOD_OPTIONS.map((o) => (
                            <option key={o.value} value={o.value}>
                                {o.label}
                            </option>
                        ))}
                    </select>
                </div>
                <button
                    className={styles["refresh-btn"]}
                    onClick={fetchAll}
                    disabled={loading}
                >
                    {loading ? "Refreshing…" : "↻ Refresh"}
                </button>
            </div>

            {error && <div className={styles["error-banner"]}>⚠ {error}</div>}

            {loading && !overview && !growth && !engagement && !spending && !retention ? (
                <div className={styles["loading"]}>
                    <div className={styles["spinner"]} />
                    Loading user analytics…
                </div>
            ) : (
                <>
                    {/* ── Overview KPIs ─────────────────────────────── */}
                    {overview && (
                        <div className={styles["hero-grid"]}>
                            <div className={`${styles["hero-card"]} ${styles["hero-card--users"]}`}>
                                <div className={styles["hero-card__label"]}>Total Users</div>
                                <div className={styles["hero-card__value"]}>{fmtNum(overview.total_users)}</div>
                                <div className={styles["hero-card__hint"]}>all registered</div>
                            </div>
                            <div className={`${styles["hero-card"]} ${styles["hero-card--dau"]}`}>
                                <div className={styles["hero-card__label"]}>DAU</div>
                                <div className={styles["hero-card__value"]}>{fmtNum(overview.dau)}</div>
                                <div className={styles["hero-card__hint"]}>daily active</div>
                            </div>
                            <div className={`${styles["hero-card"]} ${styles["hero-card--revenue"]}`}>
                                <div className={styles["hero-card__label"]}>Revenue Today</div>
                                <div className={styles["hero-card__value"]}>{fmtCost(overview.revenue_today_usd)}</div>
                                <div className={styles["hero-card__hint"]}>{fmtCost(overview.revenue_month_usd)} this month</div>
                            </div>
                            <div className={`${styles["hero-card"]} ${styles["hero-card--subs"]}`}>
                                <div className={styles["hero-card__label"]}>Active Subs</div>
                                <div className={styles["hero-card__value"]}>{fmtNum(overview.active_subscriptions)}</div>
                                <div className={styles["hero-card__hint"]}>subscriptions</div>
                            </div>
                            <div className={`${styles["hero-card"]} ${styles["hero-card--msgs"]}`}>
                                <div className={styles["hero-card__label"]}>Messages Today</div>
                                <div className={styles["hero-card__value"]}>{fmtNum(overview.messages_today)}</div>
                                <div className={styles["hero-card__hint"]}>sent today</div>
                            </div>
                            <div className={`${styles["hero-card"]} ${styles["hero-card--calls"]}`}>
                                <div className={styles["hero-card__label"]}>Calls Today</div>
                                <div className={styles["hero-card__value"]}>{fmtNum(overview.calls_today)}</div>
                                <div className={styles["hero-card__hint"]}>voice calls</div>
                            </div>
                        </div>
                    )}

                    {/* ── User Growth ───────────────────────────────── */}
                    {growth && (
                        <div className={styles["section"]}>
                            <div className={styles["section-header"]}>
                                <div className={styles["section-title"]}>User Growth</div>
                                <div className={styles["section-badge"]}>
                                    {growth.total_users} total
                                </div>
                            </div>

                            <div className={styles["hero-grid"]} style={{ marginBottom: 16 }}>
                                <div className={styles["hero-card"]}>
                                    <div className={styles["hero-card__label"]}>Verified</div>
                                    <div className={styles["hero-card__value"]} style={{ color: "#4ADE80" }}>
                                        {fmtNum(growth.verified_users)}
                                    </div>
                                </div>
                                <div className={styles["hero-card"]}>
                                    <div className={styles["hero-card__label"]}>Unverified</div>
                                    <div className={styles["hero-card__value"]} style={{ color: "#FB7185" }}>
                                        {fmtNum(growth.unverified_users)}
                                    </div>
                                </div>
                                <div className={styles["hero-card"]}>
                                    <div className={styles["hero-card__label"]}>ID Verified</div>
                                    <div className={styles["hero-card__value"]} style={{ color: "#06B6D4" }}>
                                        {fmtNum(growth.identity_verified)}
                                    </div>
                                </div>
                                <div className={styles["hero-card"]}>
                                    <div className={styles["hero-card__label"]}>Age Verified</div>
                                    <div className={styles["hero-card__value"]} style={{ color: "#FACC15" }}>
                                        {fmtNum(growth.age_verified)}
                                    </div>
                                </div>
                            </div>

                            {growthChartData.length > 0 && (
                                <div className={styles["chart-wrap"]}>
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart data={growthChartData} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                                            <XAxis
                                                dataKey="name"
                                                tick={{ fill: "rgba(255,255,255,0.6)", fontSize: 11 }}
                                                axisLine={{ stroke: "rgba(255,255,255,0.08)" }}
                                                tickLine={false}
                                            />
                                            <YAxis
                                                tick={{ fill: "rgba(255,255,255,0.5)", fontSize: 11 }}
                                                axisLine={false}
                                                tickLine={false}
                                                tickFormatter={fmtNum}
                                            />
                                            <Tooltip content={<ChartTooltip />} />
                                            <Bar dataKey="signups" name="Signups" radius={[6, 6, 0, 0]}>
                                                {growthChartData.map((_, i) => (
                                                    <Cell key={i} fill={BAR_COLORS[i % BAR_COLORS.length]} />
                                                ))}
                                            </Bar>
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            )}
                        </div>
                    )}

                    {/* ── Engagement + Spending side-by-side ────────── */}
                    <div className={styles["two-col"]}>
                        {/* Engagement */}
                        {engagement && (
                            <div className={styles["section"]}>
                                <div className={styles["section-header"]}>
                                    <div className={styles["section-title"]}>User Engagement</div>
                                    <div className={styles["section-badge"]}>
                                        {fmtNum(engagement.active_users)} active
                                    </div>
                                </div>

                                <div className={styles["hero-grid"]} style={{ marginBottom: 14 }}>
                                    <div className={styles["hero-card"]}>
                                        <div className={styles["hero-card__label"]}>Messages</div>
                                        <div className={styles["hero-card__value"]} style={{ color: "#06B6D4", fontSize: 20 }}>
                                            {fmtNum(engagement.total_messages)}
                                        </div>
                                    </div>
                                    <div className={styles["hero-card"]}>
                                        <div className={styles["hero-card__label"]}>Calls</div>
                                        <div className={styles["hero-card__value"]} style={{ color: "#FB7185", fontSize: 20 }}>
                                            {fmtNum(engagement.total_calls)}
                                        </div>
                                    </div>
                                    <div className={styles["hero-card"]}>
                                        <div className={styles["hero-card__label"]}>Call Time</div>
                                        <div className={styles["hero-card__value"]} style={{ color: "#FACC15", fontSize: 20 }}>
                                            {fmtDuration(engagement.total_call_duration_secs)}
                                        </div>
                                    </div>
                                </div>

                                {/* Channel breakdown chart */}
                                {channelChartData.length > 0 && (
                                    <div className={styles["chart-wrap"]} style={{ height: 180 }}>
                                        <ResponsiveContainer width="100%" height="100%">
                                            <BarChart data={channelChartData} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                                                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                                                <XAxis dataKey="name" tick={{ fill: "rgba(255,255,255,0.6)", fontSize: 11 }} tickLine={false} />
                                                <YAxis tick={{ fill: "rgba(255,255,255,0.5)", fontSize: 11 }} axisLine={false} tickLine={false} />
                                                <Tooltip content={<ChartTooltip />} />
                                                <Bar dataKey="count" name="Messages" fill="#00A9F1" radius={[6, 6, 0, 0]} />
                                            </BarChart>
                                        </ResponsiveContainer>
                                    </div>
                                )}

                                {/* Relationship stages */}
                                {engagement.relationship_stages && Object.keys(engagement.relationship_stages).length > 0 && (
                                    <>
                                        <div className={styles["section-title"]} style={{ fontSize: 13, marginTop: 14 }}>
                                            Relationship Stages
                                        </div>
                                        <div className={styles["stage-bar"]}>
                                            {Object.entries(engagement.relationship_stages).map(([stage, count]) => (
                                                <div key={stage} className={styles["stage-chip"]}>
                                                    <span>{stage}</span>
                                                    <strong>{count}</strong>
                                                </div>
                                            ))}
                                        </div>
                                    </>
                                )}

                                {/* Top active users */}
                                {engagement.top_active_users?.length > 0 && (
                                    <>
                                        <div className={styles["section-title"]} style={{ fontSize: 13, marginTop: 14 }}>
                                            Top Active Users
                                        </div>
                                        <div className={styles["table-wrap"]}>
                                            <table className={styles["table"]}>
                                                <thead>
                                                    <tr>
                                                        <th>#</th>
                                                        <th>User</th>
                                                        <th>Messages</th>
                                                        <th>Calls</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {engagement.top_active_users.map((u, i) => (
                                                        <tr key={u.user_id} onClick={() => setDetailUserId(u.user_id)}>
                                                            <td data-label="#">
                                                                <span className={`${styles["rank"]} ${rankClass(i)}`}>{i + 1}</span>
                                                            </td>
                                                            <td data-label="User">{u.username || `#${u.user_id}`}</td>
                                                            <td data-label="Messages">{fmtNum(u.messages)}</td>
                                                            <td data-label="Calls">{fmtNum(u.calls)}</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </>
                                )}
                            </div>
                        )}

                        {/* Spending */}
                        {spending && (
                            <div className={styles["section"]}>
                                <div className={styles["section-header"]}>
                                    <div className={styles["section-title"]}>User Spending</div>
                                    <div className={styles["section-badge"]}>
                                        {spending.paying_users} paying
                                    </div>
                                </div>

                                <div className={styles["hero-grid"]} style={{ marginBottom: 14 }}>
                                    <div className={styles["hero-card"]}>
                                        <div className={styles["hero-card__label"]}>Revenue</div>
                                        <div className={styles["hero-card__value"]} style={{ color: "#4ADE80", fontSize: 20 }}>
                                            {fmtCost(spending.total_revenue_usd)}
                                        </div>
                                    </div>
                                    <div className={styles["hero-card"]}>
                                        <div className={styles["hero-card__label"]}>ARPU</div>
                                        <div className={styles["hero-card__value"]} style={{ color: "#A855F7", fontSize: 20 }}>
                                            {fmtCost(spending.arpu_usd)}
                                        </div>
                                    </div>
                                    <div className={styles["hero-card"]}>
                                        <div className={styles["hero-card__label"]}>Wallet Balance</div>
                                        <div className={styles["hero-card__value"]} style={{ color: "#FACC15", fontSize: 20 }}>
                                            {fmtCost(spending.wallet_total_balance)}
                                        </div>
                                    </div>
                                </div>

                                {/* Revenue split */}
                                <div className={styles["hero-grid"]} style={{ marginBottom: 14 }}>
                                    <div className={styles["hero-card"]}>
                                        <div className={styles["hero-card__label"]}>Top-ups</div>
                                        <div className={styles["hero-card__value"]} style={{ fontSize: 18 }}>
                                            {fmtCost(spending.total_topups_usd)}
                                        </div>
                                    </div>
                                    <div className={styles["hero-card"]}>
                                        <div className={styles["hero-card__label"]}>Subscriptions</div>
                                        <div className={styles["hero-card__value"]} style={{ fontSize: 18 }}>
                                            {fmtCost(spending.total_subscriptions_usd)}
                                        </div>
                                    </div>
                                </div>

                                {/* Subscription breakdown */}
                                {spending.subscription_status_breakdown &&
                                    Object.keys(spending.subscription_status_breakdown).length > 0 && (
                                        <>
                                            <div className={styles["section-title"]} style={{ fontSize: 13, marginTop: 14 }}>
                                                Subscription Status
                                            </div>
                                            <div className={styles["stage-bar"]}>
                                                {Object.entries(spending.subscription_status_breakdown).map(([status, count]) => (
                                                    <div key={status} className={styles["stage-chip"]}>
                                                        <span>{status}</span>
                                                        <strong>{count}</strong>
                                                    </div>
                                                ))}
                                            </div>
                                        </>
                                    )}

                                {/* Top spenders */}
                                {spending.top_spenders?.length > 0 && (
                                    <>
                                        <div className={styles["section-title"]} style={{ fontSize: 13, marginTop: 14 }}>
                                            Top Spenders
                                        </div>
                                        <div className={styles["table-wrap"]}>
                                            <table className={styles["table"]}>
                                                <thead>
                                                    <tr>
                                                        <th>#</th>
                                                        <th>User</th>
                                                        <th>Spent</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {spending.top_spenders.map((u, i) => (
                                                        <tr key={u.user_id} onClick={() => setDetailUserId(u.user_id)}>
                                                            <td data-label="#">
                                                                <span className={`${styles["rank"]} ${rankClass(i)}`}>{i + 1}</span>
                                                            </td>
                                                            <td data-label="User">{u.username || `#${u.user_id}`}</td>
                                                            <td data-label="Spent">{fmtCost(u.total_spent)}</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </>
                                )}
                            </div>
                        )}
                    </div>

                    {/* ── Retention ─────────────────────────────────── */}
                    {retention && (
                        <div className={styles["section"]}>
                            <div className={styles["section-header"]}>
                                <div className={styles["section-title"]}>User Retention</div>
                                <div className={styles["section-badge"]}>
                                    {fmtPct(retention.stickiness_ratio)} stickiness
                                </div>
                            </div>

                            <div className={styles["hero-grid"]} style={{ marginBottom: 16 }}>
                                <div className={`${styles["hero-card"]} ${styles["hero-card--dau"]}`}>
                                    <div className={styles["hero-card__label"]}>DAU</div>
                                    <div className={styles["hero-card__value"]}>{fmtNum(retention.dau)}</div>
                                </div>
                                <div className={`${styles["hero-card"]} ${styles["hero-card--retention"]}`}>
                                    <div className={styles["hero-card__label"]}>WAU</div>
                                    <div className={styles["hero-card__value"]}>{fmtNum(retention.wau)}</div>
                                </div>
                                <div className={`${styles["hero-card"]} ${styles["hero-card--users"]}`}>
                                    <div className={styles["hero-card__label"]}>MAU</div>
                                    <div className={styles["hero-card__value"]}>{fmtNum(retention.mau)}</div>
                                </div>
                                <div className={styles["hero-card"]}>
                                    <div className={styles["hero-card__label"]}>New Today</div>
                                    <div className={styles["hero-card__value"]} style={{ color: "#4ADE80" }}>
                                        {fmtNum(retention.new_today)}
                                    </div>
                                </div>
                                <div className={styles["hero-card"]}>
                                    <div className={styles["hero-card__label"]}>New This Week</div>
                                    <div className={styles["hero-card__value"]} style={{ color: "#F97316" }}>
                                        {fmtNum(retention.new_this_week)}
                                    </div>
                                </div>
                            </div>

                            {retentionChartData.length > 0 && (
                                <div className={styles["chart-wrap"]}>
                                    <ResponsiveContainer width="100%" height="100%">
                                        <LineChart data={retentionChartData} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                                            <XAxis
                                                dataKey="name"
                                                tick={{ fill: "rgba(255,255,255,0.6)", fontSize: 11 }}
                                                axisLine={{ stroke: "rgba(255,255,255,0.08)" }}
                                                tickLine={false}
                                            />
                                            <YAxis
                                                tick={{ fill: "rgba(255,255,255,0.5)", fontSize: 11 }}
                                                axisLine={false}
                                                tickLine={false}
                                            />
                                            <Tooltip content={<ChartTooltip />} />
                                            <Line
                                                type="monotone"
                                                dataKey="active"
                                                name="Active Users"
                                                stroke="#A855F7"
                                                strokeWidth={2.5}
                                                dot={{ r: 3, fill: "#A855F7" }}
                                                activeDot={{ r: 5 }}
                                            />
                                        </LineChart>
                                    </ResponsiveContainer>
                                </div>
                            )}
                        </div>
                    )}

                    {/* ── Top Influencers (from overview) ────────────── */}
                    {overview?.top_influencers && overview.top_influencers.length > 0 && (
                        <div className={styles["section"]}>
                            <div className={styles["section-header"]}>
                                <div className={styles["section-title"]}>Top Influencers by Followers</div>
                                <div className={styles["section-badge"]}>
                                    {overview!.top_influencers.length} influencers
                                </div>
                            </div>
                            <div className={styles["table-wrap"]}>
                                <table className={styles["table"]}>
                                    <thead>
                                        <tr>
                                            <th>#</th>
                                            <th>Influencer</th>
                                            <th>Followers</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {overview!.top_influencers.map((inf, i) => (
                                            <tr key={inf.influencer_id}>
                                                <td data-label="#">
                                                    <span className={`${styles["rank"]} ${rankClass(i)}`}>{i + 1}</span>
                                                </td>
                                                <td data-label="Influencer">{inf.influencer_id}</td>
                                                <td data-label="Followers">{fmtNum(inf.followers)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </>
            )}

            {/* ── User Detail Modal ────────────────────────────── */}
            {detailUserId !== null && (
                <UserDetailModal
                    userId={detailUserId}
                    onClose={() => setDetailUserId(null)}
                />
            )}
        </div>
    );
};

export default UserAnalytics;
