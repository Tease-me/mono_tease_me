import React, { CSSProperties, ReactNode, useEffect, useRef, useState } from "react";
import styles from "./AdminTwoColumn.module.css";

const STORAGE_KEY = "admin-sidebar-width";
const DEFAULT_WIDTH = 350;
const MIN_WIDTH = 180;
const MAX_WIDTH = 600;

type AdminTwoColumnProps = {
    sidebar?: ReactNode;
    children: ReactNode;
    sidebarStyled?: boolean;
    mainStyled?: boolean;
    mainScrollable?: boolean;
};

const AdminTwoColumn: React.FC<AdminTwoColumnProps> = ({
    sidebar,
    children,
    sidebarStyled = true,
    mainStyled = true,
    mainScrollable = true,
}) => {
    const hasSidebar = sidebar !== undefined && sidebar !== null;
    const [width, setWidth] = useState(() => {
        const stored = localStorage.getItem(STORAGE_KEY);
        return stored ? Number(stored) : DEFAULT_WIDTH;
    });
    const [isDragging, setIsDragging] = useState(false);
    const dragging = useRef(false);
    const startX = useRef(0);
    const startWidth = useRef(0);
    const widthRef = useRef(width);

    // Keep widthRef in sync so mouseup can read the latest value
    useEffect(() => {
        widthRef.current = width;
    }, [width]);

    const onMouseDown = (e: React.MouseEvent) => {
        dragging.current = true;
        startX.current = e.clientX;
        startWidth.current = width;
        setIsDragging(true);
        e.preventDefault();
    };

    useEffect(() => {
        const onMove = (e: MouseEvent) => {
            if (!dragging.current) return;
            const next = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, startWidth.current + e.clientX - startX.current));
            setWidth(next);
        };
        const onUp = () => {
            if (!dragging.current) return;
            dragging.current = false;
            setIsDragging(false);
            localStorage.setItem(STORAGE_KEY, String(widthRef.current));
        };
        document.addEventListener("mousemove", onMove);
        document.addEventListener("mouseup", onUp);
        return () => {
            document.removeEventListener("mousemove", onMove);
            document.removeEventListener("mouseup", onUp);
        };
    }, []);

    return (
        <div
            className={`${styles["layout"]} ${hasSidebar ? "" : styles["layout--single"]} ${isDragging ? styles["layout--dragging"] : ""}`}
            style={hasSidebar ? ({ "--sidebar-width": `${width}px` } as CSSProperties) : undefined}
        >
            {hasSidebar ? (
                <div className={`${styles["sidebar"]} ${sidebarStyled ? styles["sidebar--card"] : ""}`}>
                    {sidebar}
                </div>
            ) : null}
            {hasSidebar ? (
                <div
                    className={`${styles["handle"]} ${isDragging ? styles["handle--dragging"] : ""}`}
                    onMouseDown={onMouseDown}
                />
            ) : null}
            <div
                className={`${styles["main"]} ${mainStyled ? styles["main--card"] : ""} ${!mainScrollable ? styles["main--no-scroll"] : ""}`}
            >
                {children}
            </div>
        </div>
    );
};

export default AdminTwoColumn;
