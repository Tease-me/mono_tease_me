import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
    Bar,
    BarChart,
    CartesianGrid,
    Cell,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from "recharts";

import { apiClient } from "@/api/apis";
import {
    AdminServices,
    FunnelOverviewResponse,
    FunnelDropoffResponse,
    FunnelRevenueResponse,
    FunnelByInfluencerResponse,
    FunnelRevenueInfluencer,
    FunnelDropoffItem,
    FunnelInfluencerData,
} from "@/api/services/AdminServices";
import styles from "./TelegramFunnelAnalytics.module.css";

const admin = AdminServices(apiClient);

type FunnelPeriod = "7d" | "30d" | "90d" | "all";

const PERIOD_OPTIONS: { value: FunnelPeriod; label: string }[] = [
    { value: "7d", label: "Last 7 days" },
    { value: "30d", label: "Last 30 days" },
    { value: "90d", label: "Last 90 days" },
    { value: "all", label: "All time" },
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

function fmtPct(n: number | null | undefined): string {
    if (n == null) return "0.0%";
    return `${n.toFixed(1)}%`;
}

function rateColorClass(pct: number): "green" | "yellow" | "red" {
    if (pct > 50) return "green";
    if (pct >= 20) return "yellow";
    return "red";
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
                <div key={p.dataKey} style={{ color: p.fill || p.stroke, marginTop: 2 }}>
                    {p.name}: {fmtNum(p.value)}
                </div>
            ))}
        </div>
    );
};

/* ── Main Component ─────────────────────────────────────── */

const TelegramFunnelAnalytics: React.FC = () => {
    const [period, setPeriod] = useState<FunnelPeriod>("30d");
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const [overview, setOverview] = useState<FunnelOverviewResponse | null>(null);
    const [dropoff, setDropoff] = useState<FunnelDropoffResponse | null>(null);
    const [revenue, setRevenue] = useState<FunnelRevenueResponse | null>(null);
    const [byInfluencer, setByInfluencer] = useState<FunnelByInfluencerResponse | null>(null);

    const [selectedInfluencer, setSelectedInfluencer] = useState<string>("__all__");

    const fetchAll = useCallback(async () => {
        setLoading(true);
        setError(null);

        const [ovRes, dropRes, revRes, inflRes] = await Promise.allSettled([
            admin.getTelegramFunnelOverview(period),
            admin.getTelegramFunnelDropoff(period),
            admin.getTelegramFunnelRevenue(period),
            admin.getTelegramFunnelByInfluencer(period),
        ]);

        if (ovRes.status === "fulfilled") setOverview(ovRes.value);
        if (dropRes.status === "fulfilled") setDropoff(dropRes.value);
        if (revRes.status === "fulfilled") setRevenue(revRes.value);
        if (inflRes.status === "fulfilled") setByInfluencer(inflRes.value);

        const errors = [ovRes, dropRes, revRes, inflRes]
            .filter((r): r is PromiseRejectedResult => r.status === "rejected")
            .map((r) => r.reason?.response?.data?.detail || r.reason?.message || "Unknown error");

        if (errors.length === 4) {
            setError(errors[0]);
        } else if (errors.length > 0) {
            setError(`${errors.length} section(s) failed to load`);
        }

        setLoading(false);
    }, [period]);

    useEffect(() => {
        fetchAll();
    }, [fetchAll]);

    /* ── Derived data ────────────────────────────────────── */

    const heroMetrics = useMemo(() => {
        const stages = overview?.stages ?? [];
        const findStage = (name: string) => stages.find((s) => s.stage === name)?.users ?? 0;
        const totalCalls = findStage("call_started");
        const registrations = findStage("registration_completed");
        const conversions = findStage("first_payment");
        const totalRevenue = revenue?.total_usd ?? 0;
        const overallRate = totalCalls > 0 ? ((registrations / totalCalls) * 100).toFixed(1) : "0.0";
        return { totalCalls, registrations, conversions, totalRevenue, overallRate };
    }, [overview, revenue]);

    const funnelChartData = useMemo(
        () => (overview?.stages ?? []).map((s) => ({ name: s.stage, users: s.users })),
        [overview]
    );

    const dropoffChartData = useMemo(
        () =>
            (dropoff?.dropoffs ?? []).map((d: FunnelDropoffItem) => ({
                name: `${d.from} -> ${d.to}`,
                dropped: d.drop_count,
                pct: d.drop_percentage,
            })),
        [dropoff]
    );

    const sortedRevenue = useMemo(
        () =>
            [...(revenue?.influencers ?? [])].sort(
                (a: FunnelRevenueInfluencer, b: FunnelRevenueInfluencer) =>
                    b.total_cents - a.total_cents
            ),
        [revenue]
    );

    const influencerOptions = useMemo(
        () => byInfluencer?.influencers?.map((inf: FunnelInfluencerData) => inf.influencer_id) ?? [],
        [byInfluencer]
    );

    const selectedInfluencerData = useMemo(() => {
        if (selectedInfluencer === "__all__" || !byInfluencer) return null;
        return byInfluencer.influencers.find(
            (inf: FunnelInfluencerData) => inf.influencer_id === selectedInfluencer
        ) ?? null;
    }, [byInfluencer, selectedInfluencer]);

    const selectedInfluencerMaxUsers = useMemo(() => {
        if (!selectedInfluencerData) return 1;
        return Math.max(...selectedInfluencerData.stages.map((s) => s.users), 1);
    }, [selectedInfluencerData]);

    return (
        <div className={styles["page"]}>
            {/* ── Toolbar ──────────────────────────────────────── */}
            <div className={styles["toolbar"]}>
                <div className={styles["toolbar-left"]}>
                    <select
                        className={styles["select"]}
                        value={period}
                        onChange={(e) => setPeriod(e.target.value as FunnelPeriod)}
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
                    {loading ? "Refreshing..." : "Refresh"}
                </button>
            </div>

            {error && <div className={styles["error-banner"]}>{error}</div>}

            {loading && !overview && !dropoff && !revenue && !byInfluencer ? (
                <div className={styles["loading"]}>
                    <div className={styles["spinner"]} />
                    Loading Telegram funnel analytics...
                </div>
            ) : (
                <>
                    {/* ── A. Funnel Overview ──────────────────────── */}
                    <div className={styles["hero-grid"]}>
                        <div className={`${styles["hero-card"]} ${styles["hero-card--calls"]}`}>
                            <div className={styles["hero-card__label"]}>Total Calls</div>
                            <div className={styles["hero-card__value"]}>{fmtNum(heroMetrics.totalCalls)}</div>
                            <div className={styles["hero-card__hint"]}>telegram bot interactions</div>
                        </div>
                        <div className={`${styles["hero-card"]} ${styles["hero-card--registrations"]}`}>
                            <div className={styles["hero-card__label"]}>Registrations</div>
                            <div className={styles["hero-card__value"]}>{fmtNum(heroMetrics.registrations)}</div>
                            <div className={styles["hero-card__hint"]}>completed sign-ups</div>
                        </div>
                        <div className={`${styles["hero-card"]} ${styles["hero-card--conversions"]}`}>
                            <div className={styles["hero-card__label"]}>Conversions</div>
                            <div className={styles["hero-card__value"]}>{fmtNum(heroMetrics.conversions)}</div>
                            <div className={styles["hero-card__hint"]}>users who paid</div>
                        </div>
                        <div className={`${styles["hero-card"]} ${styles["hero-card--revenue"]}`}>
                            <div className={styles["hero-card__label"]}>Revenue</div>
                            <div className={styles["hero-card__value"]}>{fmtCost(heroMetrics.totalRevenue)}</div>
                            <div className={styles["hero-card__hint"]}>from telegram funnel</div>
                        </div>
                        <div className={`${styles["hero-card"]} ${styles["hero-card--rate"]}`}>
                            <div className={styles["hero-card__label"]}>Conversion Rate</div>
                            <div className={styles["hero-card__value"]}>{heroMetrics.overallRate}%</div>
                            <div className={styles["hero-card__hint"]}>calls to registration</div>
                        </div>
                    </div>

                    {/* Funnel bar chart */}
                    {funnelChartData.length > 0 && (
                        <div className={styles["section"]}>
                            <div className={styles["section-header"]}>
                                <div className={styles["section-title"]}>Funnel Stages</div>
                                <div className={styles["section-badge"]}>
                                    {funnelChartData.length} stages
                                </div>
                            </div>
                            <div className={styles["funnel-chart-wrap"]}>
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart
                                        data={funnelChartData}
                                        layout="vertical"
                                        margin={{ top: 8, right: 40, bottom: 0, left: 0 }}
                                    >
                                        <CartesianGrid
                                            strokeDasharray="3 3"
                                            stroke="rgba(255,255,255,0.06)"
                                            horizontal={false}
                                        />
                                        <XAxis
                                            type="number"
                                            tick={{ fill: "rgba(255,255,255,0.5)", fontSize: 11 }}
                                            axisLine={false}
                                            tickLine={false}
                                            tickFormatter={fmtNum}
                                        />
                                        <YAxis
                                            type="category"
                                            dataKey="name"
                                            width={160}
                                            tick={{ fill: "rgba(255,255,255,0.8)", fontSize: 12, fontWeight: 600 }}
                                            axisLine={false}
                                            tickLine={false}
                                        />
                                        <Tooltip content={<ChartTooltip />} />
                                        <Bar
                                            dataKey="users"
                                            name="Users"
                                            radius={[0, 6, 6, 0]}
                                            maxBarSize={36}
                                        >
                                            {funnelChartData.map((_, i) => {
                                                const ratio = funnelChartData.length > 1
                                                    ? 1 - i / (funnelChartData.length - 1)
                                                    : 1;
                                                const r = Math.round(0 + ratio * 0);
                                                const g = Math.round(169 * ratio);
                                                const b = Math.round(241);
                                                return (
                                                    <Cell
                                                        key={i}
                                                        fill={`rgba(${r}, ${g}, ${b}, ${0.5 + ratio * 0.5})`}
                                                    />
                                                );
                                            })}
                                        </Bar>
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    )}

                    {/* ── B. Conversion Rates ────────────────────────── */}
                    {overview?.conversion_rates && overview.conversion_rates.length > 0 && (
                        <div className={styles["section"]}>
                            <div className={styles["section-header"]}>
                                <div className={styles["section-title"]}>Conversion Rates</div>
                                <div className={styles["section-badge"]}>
                                    {overview.conversion_rates.length} transitions
                                </div>
                            </div>
                            <div className={styles["table-wrap"]}>
                                <table className={styles["table"]}>
                                    <thead>
                                        <tr>
                                            <th>Transition</th>
                                            <th>From</th>
                                            <th>To</th>
                                            <th>Conversion Rate</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {overview.conversion_rates.map((cr, i) => {
                                            const color = rateColorClass(cr.percentage);
                                            return (
                                                <tr key={i}>
                                                    <td data-label="Transition">
                                                        <span className={styles["stage-arrow"]}>
                                                            <span className={styles["stage-arrow__from"]}>{cr.from}</span>
                                                            <span className={styles["stage-arrow__icon"]}>&rarr;</span>
                                                            <span className={styles["stage-arrow__to"]}>{cr.to}</span>
                                                        </span>
                                                    </td>
                                                    <td data-label="From">{fmtNum(cr.from_count)}</td>
                                                    <td data-label="To">{fmtNum(cr.to_count)}</td>
                                                    <td data-label="Conversion Rate">
                                                        <div className={styles["rate-cell"]}>
                                                            <div className={styles["rate-bar-track"]}>
                                                                <div
                                                                    className={`${styles["rate-bar-fill"]} ${styles[`rate-bar-fill--${color}`]}`}
                                                                    style={{ width: `${Math.min(cr.percentage, 100)}%` }}
                                                                />
                                                            </div>
                                                            <span className={`${styles["rate-value"]} ${styles[`rate-value--${color}`]}`}>
                                                                {fmtPct(cr.percentage)}
                                                            </span>
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {/* ── C. Drop-off Analysis ───────────────────────── */}
                    {dropoffChartData.length > 0 && (
                        <div className={styles["section"]}>
                            <div className={styles["section-header"]}>
                                <div className={styles["section-title"]}>Drop-off Analysis</div>
                                <div className={styles["section-badge"]}>
                                    {dropoffChartData.length} transitions
                                </div>
                            </div>
                            <div className={styles["chart-wrap"]}>
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart
                                        data={dropoffChartData}
                                        layout="vertical"
                                        margin={{ top: 8, right: 40, bottom: 0, left: 0 }}
                                    >
                                        <CartesianGrid
                                            strokeDasharray="3 3"
                                            stroke="rgba(255,255,255,0.06)"
                                            horizontal={false}
                                        />
                                        <XAxis
                                            type="number"
                                            tick={{ fill: "rgba(255,255,255,0.5)", fontSize: 11 }}
                                            axisLine={false}
                                            tickLine={false}
                                            tickFormatter={fmtNum}
                                        />
                                        <YAxis
                                            type="category"
                                            dataKey="name"
                                            width={160}
                                            tick={{ fill: "rgba(255,255,255,0.7)", fontSize: 11 }}
                                            axisLine={false}
                                            tickLine={false}
                                        />
                                        <Tooltip content={<ChartTooltip />} />
                                        <Bar
                                            dataKey="dropped"
                                            name="Dropped Users"
                                            radius={[0, 6, 6, 0]}
                                            maxBarSize={32}
                                        >
                                            {dropoffChartData.map((d, i) => {
                                                const convRate = 100 - d.pct;
                                                let fill: string;
                                                if (convRate > 50) fill = "#4ADE80";
                                                else if (convRate >= 20) fill = "#FACC15";
                                                else fill = "#FB7185";
                                                return <Cell key={i} fill={fill} />;
                                            })}
                                        </Bar>
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    )}

                    {/* ── D. Revenue Attribution ─────────────────────── */}
                    {revenue && (
                        <div className={styles["section"]}>
                            <div className={styles["section-header"]}>
                                <div className={styles["section-title"]}>Revenue Attribution</div>
                                <div className={styles["section-badge"]}>
                                    {sortedRevenue.length} influencers
                                </div>
                            </div>
                            <div className={styles["revenue-total"]}>
                                {fmtCost(revenue.total_usd)} total
                            </div>
                            <div className={styles["table-wrap"]}>
                                <table className={styles["table"]}>
                                    <thead>
                                        <tr>
                                            <th>#</th>
                                            <th>Influencer</th>
                                            <th>Topup Revenue</th>
                                            <th>Subscription Revenue</th>
                                            <th>Total Revenue</th>
                                            <th>Payments</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {sortedRevenue.map((inf: FunnelRevenueInfluencer, i: number) => (
                                            <tr key={inf.influencer_id}>
                                                <td data-label="#">
                                                    <span className={`${styles["rank"]} ${rankClass(i)}`}>
                                                        {i + 1}
                                                    </span>
                                                </td>
                                                <td data-label="Influencer">{inf.influencer_id}</td>
                                                <td data-label="Topup Revenue">
                                                    {fmtCost(inf.topup_cents / 100)}
                                                </td>
                                                <td data-label="Subscription Revenue">
                                                    {fmtCost(inf.subscription_cents / 100)}
                                                </td>
                                                <td data-label="Total Revenue">
                                                    <strong style={{ color: "#4ADE80" }}>
                                                        {fmtCost(inf.total_usd)}
                                                    </strong>
                                                </td>
                                                <td data-label="Payments">
                                                    {fmtNum(inf.topup_count + inf.subscription_payment_count)}
                                                </td>
                                            </tr>
                                        ))}
                                        {sortedRevenue.length === 0 && (
                                            <tr>
                                                <td colSpan={6} className={styles["empty"]}>
                                                    No revenue data
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {/* ── E. Per-Influencer Breakdown ─────────────────── */}
                    {byInfluencer && influencerOptions.length > 0 && (
                        <div className={styles["section"]}>
                            <div className={styles["section-header"]}>
                                <div className={styles["section-title"]}>Per-Influencer Breakdown</div>
                                <div className={styles["section-badge"]}>
                                    {influencerOptions.length} influencers
                                </div>
                            </div>

                            <div className={styles["influencer-select-wrap"]}>
                                <span className={styles["influencer-select-label"]}>Influencer:</span>
                                <select
                                    className={styles["select"]}
                                    value={selectedInfluencer}
                                    onChange={(e) => setSelectedInfluencer(e.target.value)}
                                >
                                    <option value="__all__">Select an influencer...</option>
                                    {influencerOptions.map((id: string) => (
                                        <option key={id} value={id}>
                                            {id}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {selectedInfluencerData ? (
                                <>
                                    <div className={styles["influencer-funnel-stages"]}>
                                        {selectedInfluencerData.stages.map((s) => (
                                            <div key={s.stage} className={styles["influencer-stage-row"]}>
                                                <span className={styles["influencer-stage-name"]}>{s.stage}</span>
                                                <div className={styles["influencer-stage-bar"]}>
                                                    <div
                                                        className={styles["influencer-stage-fill"]}
                                                        style={{
                                                            width: `${(s.users / selectedInfluencerMaxUsers) * 100}%`,
                                                        }}
                                                    />
                                                </div>
                                                <span className={styles["influencer-stage-count"]}>
                                                    {fmtNum(s.users)}
                                                </span>
                                            </div>
                                        ))}
                                    </div>

                                    {selectedInfluencerData.conversion_rates &&
                                        selectedInfluencerData.conversion_rates.length > 0 && (
                                            <div className={styles["table-wrap"]} style={{ marginTop: 14 }}>
                                                <table className={styles["table"]}>
                                                    <thead>
                                                        <tr>
                                                            <th>Transition</th>
                                                            <th>Rate</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {selectedInfluencerData.conversion_rates.map((cr, i) => {
                                                            const color = rateColorClass(cr.percentage);
                                                            return (
                                                                <tr key={i}>
                                                                    <td data-label="Transition">
                                                                        <span className={styles["stage-arrow"]}>
                                                                            <span className={styles["stage-arrow__from"]}>
                                                                                {cr.from}
                                                                            </span>
                                                                            <span className={styles["stage-arrow__icon"]}>
                                                                                &rarr;
                                                                            </span>
                                                                            <span className={styles["stage-arrow__to"]}>
                                                                                {cr.to}
                                                                            </span>
                                                                        </span>
                                                                    </td>
                                                                    <td data-label="Rate">
                                                                        <div className={styles["rate-cell"]}>
                                                                            <div className={styles["rate-bar-track"]}>
                                                                                <div
                                                                                    className={`${styles["rate-bar-fill"]} ${styles[`rate-bar-fill--${color}`]}`}
                                                                                    style={{
                                                                                        width: `${Math.min(cr.percentage, 100)}%`,
                                                                                    }}
                                                                                />
                                                                            </div>
                                                                            <span
                                                                                className={`${styles["rate-value"]} ${styles[`rate-value--${color}`]}`}
                                                                            >
                                                                                {fmtPct(cr.percentage)}
                                                                            </span>
                                                                        </div>
                                                                    </td>
                                                                </tr>
                                                            );
                                                        })}
                                                    </tbody>
                                                </table>
                                            </div>
                                        )}
                                </>
                            ) : (
                                <div className={styles["empty"]}>
                                    Select an influencer to view their funnel breakdown
                                </div>
                            )}
                        </div>
                    )}
                </>
            )}
        </div>
    );
};

export default TelegramFunnelAnalytics;
