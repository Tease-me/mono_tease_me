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
    ApiErrorRow,
    ApiUsageSummaryResponse,
    TopApiInfluencer,
    TopApiUser,
} from "@/api/services/AdminServices";
import AdminLayout from "../AdminLayout";
import styles from "./AdminAnalytics.module.css";

const admin = AdminServices(apiClient);

type Period = "1h" | "24h" | "7d" | "30d" | "90d";
type GroupBy = "category" | "model" | "provider" | "purpose";

const PERIOD_OPTIONS: { value: Period; label: string }[] = [
    { value: "1h", label: "Last 1 hour" },
    { value: "24h", label: "Last 24 hours" },
    { value: "7d", label: "Last 7 days" },
    { value: "30d", label: "Last 30 days" },
    { value: "90d", label: "Last 90 days" },
];

const GROUP_OPTIONS: { value: GroupBy; label: string }[] = [
    { value: "category", label: "Category" },
    { value: "model", label: "Model" },
    { value: "provider", label: "Provider" },
    { value: "purpose", label: "Purpose" },
];

const BAR_COLORS = [
    "#00A9F1", "#A855F7", "#4ADE80", "#FB7185",
    "#FACC15", "#F97316", "#06B6D4", "#E879F9",
    "#34D399", "#F472B6",
];



function fmtNum(n: number): string {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
    return n.toLocaleString();
}

function fmtCost(usd: number): string {
    if (usd === 0) return "$0.00";
    if (usd < 0.01) return `$${usd.toFixed(6)}`;
    if (usd < 1) return `$${usd.toFixed(4)}`;
    return `$${usd.toFixed(2)}`;
}

function fmtLatency(ms: number | null): string {
    if (ms == null) return "—";
    if (ms >= 1000) return `${(ms / 1000).toFixed(1)}s`;
    return `${Math.round(ms)}ms`;
}

function fmtDuration(secs: number | null): string {
    if (secs == null || secs === 0) return "—";
    if (secs >= 3600) return `${(secs / 3600).toFixed(1)}h`;
    if (secs >= 60) return `${(secs / 60).toFixed(1)}m`;
    return `${Math.round(secs)}s`;
}

function fmtTimestamp(iso: string): string {
    const d = new Date(iso);
    return d.toLocaleString(undefined, {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    });
}

function rankClass(i: number): string {
    if (i === 0) return styles["rank--gold"];
    if (i === 1) return styles["rank--silver"];
    if (i === 2) return styles["rank--bronze"];
    return styles["rank--default"];
}


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
                <div key={p.dataKey} style={{ color: p.fill, marginTop: 2 }}>
                    {p.name}: {fmtNum(p.value)}
                </div>
            ))}
        </div>
    );
};



const AdminAnalytics: React.FC = () => {
    const [period, setPeriod] = useState<Period>("24h");
    const [groupBy, setGroupBy] = useState<GroupBy>("category");
    const [costCategory, setCostCategory] = useState<string>("__all__");

    const [summary, setSummary] = useState<ApiUsageSummaryResponse | null>(null);
    const [topUsers, setTopUsers] = useState<TopApiUser[]>([]);
    const [topInfluencers, setTopInfluencers] = useState<TopApiInfluencer[]>([]);
    const [errors, setErrors] = useState<ApiErrorRow[]>([]);
    const [totalErrors, setTotalErrors] = useState(0);

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchAll = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const [sumRes, usersRes, inflRes, errRes] = await Promise.all([
                admin.getApiUsageSummary(period, groupBy),
                admin.getTopApiUsers(period),
                admin.getTopApiInfluencers(period),
                admin.getApiErrors(period),
            ]);
            setSummary(sumRes);
            setTopUsers(usersRes.users);
            setTopInfluencers(inflRes.influencers);
            setErrors(errRes.errors);
            setTotalErrors(errRes.total_errors);
        } catch (e: any) {
            setError(e?.response?.data?.detail || e?.message || "Failed to load analytics data");
        } finally {
            setLoading(false);
        }
    }, [period, groupBy]);

    useEffect(() => {
        fetchAll();
    }, [fetchAll]);


    useEffect(() => {
        setCostCategory("__all__");
    }, [groupBy]);


    const categoryOptions = useMemo(() => {
        if (!summary?.groups?.length || groupBy !== "category") return [];
        return summary.groups.map((g) => g.key).sort();
    }, [summary, groupBy]);


    const filteredGroups = useMemo(() => {
        const groups = summary?.groups ?? [];
        if (costCategory === "__all__" || groupBy !== "category") return groups;
        return groups.filter((g) => g.key === costCategory);
    }, [summary, costCategory, groupBy]);


    const heroMetrics = useMemo(() => {
        if (!filteredGroups.length)
            return { calls: 0, tokens: 0, cost: 0, errorRate: 0, avgLatency: 0 };

        const g = filteredGroups;
        const calls = g.reduce((s, r) => s + r.total_calls, 0);
        const tokens = g.reduce((s, r) => s + r.total_tokens, 0);
        const cost = g.reduce((s, r) => s + r.estimated_cost_usd, 0);
        const errCount = g.reduce((s, r) => s + r.error_count, 0);
        const latencySum = g.reduce(
            (s, r) => s + (r.avg_latency_ms ?? 0) * r.total_calls,
            0
        );
        return {
            calls,
            tokens,
            cost,
            errorRate: calls > 0 ? (errCount / calls) * 100 : 0,
            avgLatency: calls > 0 ? latencySum / calls : 0,
        };
    }, [filteredGroups]);


    const chartData = useMemo(
        () =>
            filteredGroups.map((g) => ({
                name: g.key,
                calls: g.total_calls,
                tokens: g.total_tokens,
            })),
        [filteredGroups]
    );

    return (
        <AdminLayout
            title="Analytics"
            subtitle="API usage, costs, and error tracking across the platform."
        >
            <div className={styles["page"]}>

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

                        <select
                            className={styles["select"]}
                            value={groupBy}
                            onChange={(e) => setGroupBy(e.target.value as GroupBy)}
                        >
                            {GROUP_OPTIONS.map((o) => (
                                <option key={o.value} value={o.value}>
                                    Group by: {o.label}
                                </option>
                            ))}
                        </select>

                        {groupBy === "category" && categoryOptions.length > 0 && (
                            <select
                                className={styles["select"]}
                                value={costCategory}
                                onChange={(e) => setCostCategory(e.target.value)}
                            >
                                <option value="__all__">All Categories</option>
                                {categoryOptions.map((cat) => (
                                    <option key={cat} value={cat}>
                                        {cat}
                                    </option>
                                ))}
                            </select>
                        )}
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

                {loading && !summary ? (
                    <div className={styles["loading"]}>
                        <div className={styles["spinner"]} />
                        Loading analytics…
                    </div>
                ) : (
                    <>

                        <div className={styles["hero-grid"]}>
                            <div className={`${styles["hero-card"]} ${styles["hero-card--calls"]}`}>
                                <div className={styles["hero-card__label"]}>Total API Calls</div>
                                <div className={styles["hero-card__value"]}>{fmtNum(heroMetrics.calls)}</div>
                                <div className={styles["hero-card__hint"]}>{period} window</div>
                            </div>
                            <div className={`${styles["hero-card"]} ${styles["hero-card--tokens"]}`}>
                                <div className={styles["hero-card__label"]}>Total Tokens</div>
                                <div className={styles["hero-card__value"]}>{fmtNum(heroMetrics.tokens)}</div>
                                <div className={styles["hero-card__hint"]}>input + output combined</div>
                            </div>
                            <div className={`${styles["hero-card"]} ${styles["hero-card--cost"]}`}>
                                <div className={styles["hero-card__label"]}>Est. Cost</div>
                                <div className={styles["hero-card__value"]}>{fmtCost(heroMetrics.cost)}</div>
                                <div className={styles["hero-card__hint"]}>estimated USD total</div>
                            </div>
                            <div className={`${styles["hero-card"]} ${styles["hero-card--errors"]}`}>
                                <div className={styles["hero-card__label"]}>Error Rate</div>
                                <div className={styles["hero-card__value"]}>
                                    {heroMetrics.errorRate.toFixed(1)}%
                                </div>
                                <div className={styles["hero-card__hint"]}>{totalErrors} total errors</div>
                            </div>
                            <div className={`${styles["hero-card"]} ${styles["hero-card--latency"]}`}>
                                <div className={styles["hero-card__label"]}>Avg Latency</div>
                                <div className={styles["hero-card__value"]}>
                                    {fmtLatency(heroMetrics.avgLatency)}
                                </div>
                                <div className={styles["hero-card__hint"]}>weighted by call volume</div>
                            </div>
                        </div>


                        <div className={styles["section"]}>
                            <div className={styles["section-header"]}>
                                <div className={styles["section-title"]}>
                                    Usage Breakdown — by {groupBy}
                                </div>
                                <div className={styles["section-badge"]}>
                                    {summary?.groups?.length ?? 0} groups
                                </div>
                            </div>

                            {chartData.length === 0 ? (
                                <div className={styles["empty"]}>No data for this period</div>
                            ) : (
                                <div className={styles["chart-wrap"]}>
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart
                                            data={chartData}
                                            margin={{ top: 8, right: 8, bottom: 0, left: 0 }}
                                        >
                                            <CartesianGrid
                                                strokeDasharray="3 3"
                                                stroke="rgba(255,255,255,0.06)"
                                            />
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
                                            <Bar
                                                dataKey="calls"
                                                name="API Calls"
                                                radius={[6, 6, 0, 0]}
                                            >
                                                {chartData.map((_, i) => (
                                                    <Cell
                                                        key={i}
                                                        fill={BAR_COLORS[i % BAR_COLORS.length]}
                                                    />
                                                ))}
                                            </Bar>
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            )}
                        </div>


                        <div className={styles["section"]}>
                            <div className={styles["section-header"]}>
                                <div className={styles["section-title"]}>
                                    Detailed Breakdown
                                </div>
                            </div>
                            <div className={styles["table-wrap"]}>
                                <table className={styles["table"]}>
                                    <thead>
                                        <tr>
                                            <th>{groupBy}</th>
                                            <th>Calls</th>
                                            <th>Input Tok</th>
                                            <th>Output Tok</th>
                                            <th>Total Tok</th>
                                            <th>Cost</th>
                                            <th>Avg Latency</th>
                                            <th>Max Latency</th>
                                            <th>Duration</th>
                                            <th>Errors</th>
                                            <th>Error %</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredGroups.map((g) => (
                                            <tr key={g.key}>
                                                <td data-label={groupBy}>
                                                    <span className={styles["pill"]}>{g.key}</span>
                                                </td>
                                                <td data-label="Calls">{fmtNum(g.total_calls)}</td>
                                                <td data-label="Input Tok">{fmtNum(g.total_input_tokens)}</td>
                                                <td data-label="Output Tok">{fmtNum(g.total_output_tokens)}</td>
                                                <td data-label="Total Tok">{fmtNum(g.total_tokens)}</td>
                                                <td data-label="Cost">{fmtCost(g.estimated_cost_usd)}</td>
                                                <td data-label="Avg Latency">{fmtLatency(g.avg_latency_ms)}</td>
                                                <td data-label="Max Latency">{fmtLatency(g.max_latency_ms)}</td>
                                                <td data-label="Duration">{fmtDuration(g.total_duration_secs)}</td>
                                                <td data-label="Errors">{g.error_count}</td>
                                                <td data-label="Error %">{g.error_rate.toFixed(1)}%</td>
                                            </tr>
                                        ))}
                                        {filteredGroups.length === 0 && (
                                            <tr>
                                                <td colSpan={11} className={styles["empty"]}>
                                                    No data
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>


                        <div className={styles["two-col"]}>

                            <div className={styles["section"]}>
                                <div className={styles["section-header"]}>
                                    <div className={styles["section-title"]}>Top Users</div>
                                    <div className={styles["section-badge"]}>
                                        {topUsers.length} users
                                    </div>
                                </div>
                                <div className={styles["table-wrap"]}>
                                    <table className={styles["table"]}>
                                        <thead>
                                            <tr>
                                                <th>#</th>
                                                <th>User ID</th>
                                                <th>Calls</th>
                                                <th>Tokens</th>
                                                <th>Cost</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {topUsers.map((u, i) => (
                                                <tr key={u.user_id}>
                                                    <td data-label="#">
                                                        <span className={`${styles["rank"]} ${rankClass(i)}`}>
                                                            {i + 1}
                                                        </span>
                                                    </td>
                                                    <td data-label="User ID">{u.user_id}</td>
                                                    <td data-label="Calls">{fmtNum(u.total_calls)}</td>
                                                    <td data-label="Tokens">{fmtNum(u.total_tokens)}</td>
                                                    <td data-label="Cost">{fmtCost(u.estimated_cost_usd)}</td>
                                                </tr>
                                            ))}
                                            {topUsers.length === 0 && (
                                                <tr>
                                                    <td colSpan={5} className={styles["empty"]}>
                                                        No user data
                                                    </td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>


                            <div className={styles["section"]}>
                                <div className={styles["section-header"]}>
                                    <div className={styles["section-title"]}>Top Influencers</div>
                                    <div className={styles["section-badge"]}>
                                        {topInfluencers.length} influencers
                                    </div>
                                </div>
                                <div className={styles["table-wrap"]}>
                                    <table className={styles["table"]}>
                                        <thead>
                                            <tr>
                                                <th>#</th>
                                                <th>Influencer</th>
                                                <th>Calls</th>
                                                <th>Tokens</th>
                                                <th>Cost</th>
                                                <th>Call Time</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {topInfluencers.map((inf, i) => (
                                                <tr key={inf.influencer_id}>
                                                    <td data-label="#">
                                                        <span className={`${styles["rank"]} ${rankClass(i)}`}>
                                                            {i + 1}
                                                        </span>
                                                    </td>
                                                    <td data-label="Influencer">{inf.influencer_id}</td>
                                                    <td data-label="Calls">{fmtNum(inf.total_calls)}</td>
                                                    <td data-label="Tokens">{fmtNum(inf.total_tokens)}</td>
                                                    <td data-label="Cost">{fmtCost(inf.estimated_cost_usd)}</td>
                                                    <td data-label="Call Time">{fmtDuration(inf.total_call_secs)}</td>
                                                </tr>
                                            ))}
                                            {topInfluencers.length === 0 && (
                                                <tr>
                                                    <td colSpan={6} className={styles["empty"]}>
                                                        No influencer data
                                                    </td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>


                        <div className={styles["section"]}>
                            <div className={styles["section-header"]}>
                                <div className={styles["section-title"]}>Recent Errors</div>
                                <div className={styles["section-badge"]}>
                                    {totalErrors} errors
                                </div>
                            </div>
                            <div className={styles["table-wrap"]}>
                                <table className={styles["table"]}>
                                    <thead>
                                        <tr>
                                            <th>Time</th>
                                            <th>Category</th>
                                            <th>Provider</th>
                                            <th>Model</th>
                                            <th>Purpose</th>
                                            <th>User</th>
                                            <th>Influencer</th>
                                            <th>Error</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {errors.map((e) => (
                                            <tr key={e.id}>
                                                <td data-label="Time">{fmtTimestamp(e.created_at)}</td>
                                                <td data-label="Category">
                                                    <span className={styles["pill"]}>{e.category}</span>
                                                </td>
                                                <td data-label="Provider">{e.provider}</td>
                                                <td data-label="Model">{e.model}</td>
                                                <td data-label="Purpose">{e.purpose}</td>
                                                <td data-label="User">{e.user_id ?? "—"}</td>
                                                <td data-label="Influencer">{e.influencer_id ?? "—"}</td>
                                                <td data-label="Error">
                                                    <span className={styles["error-msg"]}>
                                                        {e.error_message ?? "—"}
                                                    </span>
                                                </td>
                                            </tr>
                                        ))}
                                        {errors.length === 0 && (
                                            <tr>
                                                <td colSpan={8} className={styles["empty"]}>
                                                    No errors in this period 🎉
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </>
                )}
            </div>
        </AdminLayout>
    );
};

export default AdminAnalytics;
