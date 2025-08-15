// components/DataTable.tsx
import React from "react";
import styles from "./DataTable.module.css";
import SvgPack from "@/utils/SvgPack";

export type ColumnDef<T> = {
    key: keyof T | string;
    header: string | React.ReactNode;
    // If provided, renders the cell; otherwise it will show row[col.key] directly.
    cell?: (row: T) => React.ReactNode;
    // optional alignment or width hooks
    align?: "left" | "center" | "right";
    width?: string; // e.g. "140px" or "1fr"
    sortable?: boolean; // (hook for later)
};

type Props<T> = {
    data: T[] | undefined;
    columns: ColumnDef<T>[];
    rowKey: (row: T, idx: number) => string;
    emptyState?: React.ReactNode;
};

export function DataTable<T>({ data, columns, rowKey, emptyState }: Props<T>) {
    if (!data?.length) {
        return <div className={styles["table-empty"]}>{emptyState ?? "No data"}</div>;
    }

    const gridTemplateColumns = columns.map((c) => c.width || "1fr").join(" ");

    return (
        <div className={styles["grid-table"]}>
            <div className={styles["grid-header-row"]} style={{ gridTemplateColumns }}>
                {columns.map((column) => (
                    <div
                        key={String(column.key)}
                        className={styles["grid-header"]}
                        style={{ textAlign: column.align ?? "left" }}
                    >
                        {column.header}
                        {column.sortable && <SvgPack.ChevronUpDown />}
                    </div>
                ))}
            </div>
            <div className={styles["grid-body"]}>
                {data.map((row, i) => (
                    <div className={styles["grid-row"]} style={{ gridTemplateColumns }} key={rowKey(row, i)}>
                        {columns.map((column) => (
                            <div
                                key={String(column.key)}
                                className={styles["grid-cell"]}
                                style={{ textAlign: column.align ?? "left" }}
                            >
                                {column.cell ? column.cell(row) : (row as any)[column.key]}
                            </div>
                        ))}
                    </div>
                ))}
            </div>
        </div>
    );
}