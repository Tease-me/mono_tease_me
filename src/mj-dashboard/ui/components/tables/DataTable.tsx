import React, { CSSProperties } from "react";
import styles from "./DataTable.module.css";
import SvgPack from "@/utils/SvgPack";

export type ColumnDef<T> = {
    key: keyof T | string;
    header: string | React.ReactNode;
    cell?: (row: T) => React.ReactNode;
    align?: "left" | "center" | "right";
    width?: string;
    sortable?: boolean;
};

type Props<T> = {
    data: T[] | undefined;
    columns: ColumnDef<T>[];
    rowKey: (row: T, idx: number) => string;
    emptyState?: React.ReactNode;
    onSort?: (columnKey: keyof T | string) => void;
};

export function DataTable<T>({ data, columns, rowKey, emptyState, onSort }: Props<T>) {
    if (!data?.length) {
        return <div className={styles["table-empty"]}>{emptyState ?? "No data"}</div>;
    }

    const gridTemplateColumns = columns.map((c) => c.width || "1fr").join(" ");

    const getAlignment = (column: ColumnDef<T>): CSSProperties => {
        return {
            textAlign: column.align ?? "left",
            justifyContent: column.align ?? "left",
        }
    }

    return (
        <div className={styles["grid-table"]}>
            <div className={styles["grid-header-row"]} style={{ gridTemplateColumns }}>
                {columns.map((column) => (
                    <div
                        key={String(column.key)}
                        className={styles["grid-header"]}
                        onClick={() => column.sortable && onSort?.(column.key)}
                        style={{ cursor: column.sortable ? "pointer" : "default" }}
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
                                style={getAlignment(column)}
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