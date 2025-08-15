// components/DataTable.tsx
import React from "react";
import styles from "./DataTable.module.css";

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

    return (
        <div className={styles["table-wrap"]}>
            <div
                className={styles["grid-table"]}
                style={{
                    display: "grid",
                    gridTemplateColumns: columns.map((c) => c.width || "1fr").join(" "),
                }}
            >
                {columns.map((c) => (
                    <div
                        key={String(c.key)}
                        className={styles["grid-header"]}
                        style={{ textAlign: c.align ?? "left" }}
                    >
                        {c.header}
                    </div>
                ))}
                {data.map((row, i) => (
                    <React.Fragment key={rowKey(row, i)}>
                        {columns.map((c) => (
                            <div
                                key={String(c.key)}
                                className={styles["grid-cell"]}
                                style={{ textAlign: c.align ?? "left" }}
                            >
                                {c.cell ? c.cell(row) : (row as any)[c.key]}
                            </div>
                        ))}
                    </React.Fragment>
                ))}
            </div>
        </div>
    );
}