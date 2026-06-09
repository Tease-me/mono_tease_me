import React, { useMemo } from 'react';
import clsx from 'clsx';
import styles from "./BillingContent.module.css";
import SvgPack from '@/utils/SvgPack';
import Badge, { BadgeType } from '@/mj-dashboard/ui/components/badge/Badge';
import { SubscriptionLevel } from '@/mj-dashboard/data/models/enums';

type StatusTone = "success" | "warning" | "danger" | "neutral";

interface StatusMeta {
    label: string;
    badgeType: BadgeType;
    tone: StatusTone;
}

interface InfluenceIncomeRow {
    id: string;
    date: string;
    name: string;
    creatorId: string;
    commissionRate: number;
    totalIncome: number;
    totalCommission: number;
    status: keyof typeof STATUS_CONFIG;
    completed: string;
}

interface UserBillingRow {
    id: string;
    date: string;
    name: string;
    orderId: string;
    plan: SubscriptionLevel;
    amount: number;
    currency: string;
    currencySymbol: string;
    status: keyof typeof STATUS_CONFIG;
    completed: string;
}

interface TableColumn<Row extends { id: string }> {
    key: keyof Row;
    label: string;
    align?: "left" | "right" | "center";
    sortable?: boolean;
    render?: (row: Row) => React.ReactNode;
}

const STATUS_CONFIG: Record<string, StatusMeta> = {
    completed: { label: "Completed", badgeType: "success", tone: "success" },
    processing: { label: "Processing", badgeType: "warning", tone: "warning" },
    success: { label: "Success", badgeType: "success", tone: "success" },
    failed: { label: "Failed", badgeType: "danger", tone: "danger" },
    cancelled: { label: "Cancelled", badgeType: "neutral", tone: "neutral" },
};

type PlanTone = "basic" | "premium" | "ultimate";

const PLAN_META: Record<SubscriptionLevel, { label: string; tone: PlanTone; icon: () => React.ReactNode }> = {
    [SubscriptionLevel.basic]: {
        label: "Basic",
        tone: "basic",
        icon: () => <SvgPack.Star />,
    },
    [SubscriptionLevel.premium]: {
        label: "Premium",
        tone: "premium",
        icon: () => <SvgPack.Triseption />,
    },
    [SubscriptionLevel.ultimate]: {
        label: "Ultimate",
        tone: "ultimate",
        icon: () => <SvgPack.Crown />,
    },
};

const formatCurrency = (value: number, currencySymbol: string = "$"): string =>
    `${currencySymbol}${value.toFixed(2)}`;

const renderStatus = (statusKey: keyof typeof STATUS_CONFIG) => {
    const meta = STATUS_CONFIG[statusKey] ?? STATUS_CONFIG.completed;
    return (
        <Badge
            type={meta.badgeType}
            className={clsx(styles["status-chip"], styles[`status-chip--${meta.tone}`])}
        >
            {meta.label}
        </Badge>
    );
};

const renderPlan = (plan: SubscriptionLevel) => {
    const meta = PLAN_META[plan];
    return (
        <span className={clsx(styles["plan-pill"], styles[`plan-pill--${meta.tone}`])}>
            <span className={styles["plan-pill__icon"]}>{meta.icon()}</span>
            {meta.label}
        </span>
    );
};

const BillingContentCard = <Row extends { id: string }>({
    title,
    columns,
    rows,
}: {
    title: string;
    columns: TableColumn<Row>[];
    rows: Row[];
}) => {
    return (
        <section className={styles["card"]}>
            <div className={styles["card-header"]}>{title}</div>
            <div className={styles["table-wrapper"]}>
                <table className={styles["table"]}>
                    <thead>
                        <tr>
                            {columns.map((column) => (
                                <th
                                    key={String(column.key)}
                                    className={clsx(
                                        styles["header-cell"],
                                        column.align && styles[`header-cell--${column.align}`],
                                    )}
                                >
                                    <span className={styles["header-cell__content"]}>
                                        {column.label}
                                        {column.sortable !== false && (
                                            <span className={styles["sort-icon"]}>
                                                <SvgPack.ChevronUpDown />
                                            </span>
                                        )}
                                    </span>
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map((row) => (
                            <tr key={row.id}>
                                {columns.map((column) => (
                                    <td
                                        key={String(column.key)}
                                        className={clsx(
                                            styles["cell"],
                                            column.align && styles[`cell--${column.align}`],
                                        )}
                                    >
                                        {column.render
                                            ? column.render(row)
                                            : (row[column.key] as React.ReactNode)}
                                    </td>
                                ))}
                            </tr>
                        ))}
                        {!rows.length && (
                            <tr>
                                <td className={styles["empty-cell"]} colSpan={columns.length}>
                                    No records available.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </section>
    );
};

interface BillingContentProps {
}

const BillingContent: React.FC<BillingContentProps> = ({ }) => {
    const influenceIncomeRows = useMemo<InfluenceIncomeRow[]>(() => [
        {
            id: "row-1",
            date: "03/16/2025 10:00:45",
            name: "UserA",
            creatorId: "T1436",
            commissionRate: 75,
            totalIncome: 3000,
            totalCommission: 2250,
            status: "completed",
            completed: "03/16/2025 10:00:45",
        },
        {
            id: "row-2",
            date: "03/17/2025 09:30:12",
            name: "UserB",
            creatorId: "T1437",
            commissionRate: 100,
            totalIncome: 1500,
            totalCommission: 1500,
            status: "completed",
            completed: "03/17/2025 09:30:12",
        },
        {
            id: "row-3",
            date: "03/18/2025 14:22:05",
            name: "UserC",
            creatorId: "T1438",
            commissionRate: 20,
            totalIncome: 5000,
            totalCommission: 1000,
            status: "processing",
            completed: "03/18/2025 14:22:05",
        },
        {
            id: "row-4",
            date: "03/19/2025 15:11:57",
            name: "UserD",
            creatorId: "T1439",
            commissionRate: 60,
            totalIncome: 4500,
            totalCommission: 2700,
            status: "processing",
            completed: "03/19/2025 15:11:57",
        },
        {
            id: "row-5",
            date: "03/20/2025 08:45:30",
            name: "UserE",
            creatorId: "T1440",
            commissionRate: 90,
            totalIncome: 3500,
            totalCommission: 3150,
            status: "processing",
            completed: "03/20/2025 08:45:30",
        },
    ], []);

    const userBillingRows = useMemo<UserBillingRow[]>(() => [
        {
            id: "billing-1",
            date: "03/15/2025 10:56:30",
            name: "Username",
            orderId: "T1435",
            plan: SubscriptionLevel.basic,
            amount: 84.99,
            currency: "AUD",
            currencySymbol: "$",
            status: "success",
            completed: "03/15/2025 10:56:30",
        },
        {
            id: "billing-2",
            date: "03/15/2025 10:56:30",
            name: "Username",
            orderId: "T1435",
            plan: SubscriptionLevel.basic,
            amount: 84.99,
            currency: "AUD",
            currencySymbol: "$",
            status: "processing",
            completed: "03/15/2025 10:56:30",
        },
        {
            id: "billing-3",
            date: "03/15/2025 10:56:30",
            name: "Username",
            orderId: "T1435",
            plan: SubscriptionLevel.premium,
            amount: 84.99,
            currency: "AUD",
            currencySymbol: "$",
            status: "failed",
            completed: "03/15/2025 10:56:30",
        },
        {
            id: "billing-4",
            date: "03/15/2025 10:56:30",
            name: "Username",
            orderId: "T1435",
            plan: SubscriptionLevel.ultimate,
            amount: 84.99,
            currency: "AUD",
            currencySymbol: "$",
            status: "cancelled",
            completed: "03/15/2025 10:56:30",
        },
        {
            id: "billing-5",
            date: "03/15/2025 10:56:30",
            name: "Username",
            orderId: "T1435",
            plan: SubscriptionLevel.premium,
            amount: 84.99,
            currency: "AUD",
            currencySymbol: "$",
            status: "processing",
            completed: "03/15/2025 10:56:30",
        },
    ], []);

    const influenceColumns: TableColumn<InfluenceIncomeRow>[] = [
        { key: "date", label: "Date" },
        { key: "name", label: "Name" },
        { key: "creatorId", label: "Creator ID" },
        {
            key: "commissionRate",
            label: "Com Rate",
            align: "right",
            render: (row) => `${row.commissionRate}%`,
        },
        {
            key: "totalIncome",
            label: "Total Income",
            align: "right",
            render: (row) => formatCurrency(row.totalIncome),
        },
        {
            key: "totalCommission",
            label: "Total Com",
            align: "right",
            render: (row) => formatCurrency(row.totalCommission),
        },
        {
            key: "status",
            label: "Status",
            align: "center",
            render: (row) => renderStatus(row.status),
        },
        { key: "completed", label: "Completed" },
    ];

    const userBillingColumns: TableColumn<UserBillingRow>[] = [
        { key: "date", label: "Date" },
        { key: "name", label: "Name" },
        { key: "orderId", label: "Order ID" },
        {
            key: "plan",
            label: "Plan",
            align: "center",
            render: (row) => renderPlan(row.plan),
        },
        {
            key: "amount",
            label: "Amount",
            align: "right",
            render: (row) => formatCurrency(row.amount, row.currencySymbol),
        },
        {
            key: "currency",
            label: "Currency",
            align: "center",
            sortable: false,
        },
        {
            key: "status",
            label: "Status",
            align: "center",
            render: (row) => renderStatus(row.status),
        },
        { key: "completed", label: "Completed" },
    ];

    return (
        <div className={styles["billing-content"]}>
            <div className={styles["page-header"]}>
                <div className={styles["page-title"]}>User Billing History</div>
                <button type="button" className={styles["filter-button"]} aria-label="Select time range">
                    Past 7 Days
                    <span className={styles["filter-button__icon"]}>
                        <SvgPack.ChevronUpDown />
                    </span>
                </button>
            </div>

            <BillingContentCard
                title="Influence Income Table"
                columns={influenceColumns}
                rows={influenceIncomeRows}
            />

            <BillingContentCard
                title="User Billing History"
                columns={userBillingColumns}
                rows={userBillingRows}
            />
        </div>
    );
};

export default BillingContent;
