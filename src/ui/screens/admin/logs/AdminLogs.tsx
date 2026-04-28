import React, { useCallback, useEffect, useRef, useState } from "react";
import { apiClient } from "@/api/apis";
import {
  AdminServices,
  LogLine,
  LogLevel,
  LogFileInfo,
  AdminLogsParams,
} from "@/api/services/AdminServices";
import { API_BASE_URL, Endpoints } from "@/api/urls";
import AdminLayout from "@/ui/screens/admin/AdminLayout";
import AdminTwoColumn from "@/ui/screens/admin/AdminTwoColumn";
import styles from "./AdminLogs.module.css";

const admin = AdminServices(apiClient);

const LEVELS: { value: LogLevel | ""; label: string }[] = [
  { value: "", label: "All levels" },
  { value: "DEBUG", label: "DEBUG" },
  { value: "INFO", label: "INFO" },
  { value: "WARNING", label: "WARNING" },
  { value: "ERROR", label: "ERROR" },
  { value: "CRITICAL", label: "CRITICAL" },
];

const LIMITS = [50, 100, 200, 500];

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function levelClass(level: LogLevel): string {
  switch (level) {
    case "DEBUG": return styles["level--debug"];
    case "INFO": return styles["level--info"];
    case "WARNING": return styles["level--warning"];
    case "ERROR": return styles["level--error"];
    case "CRITICAL": return styles["level--critical"];
    default: return "";
  }
}

/** Parse SSE data lines from a raw text chunk. Returns an array of parsed LogLine objects. */
function parseSSEChunk(chunk: string): LogLine[] {
  const lines: LogLine[] = [];
  // Split into individual SSE "frames" by double newline
  const frames = chunk.split(/\n\n+/);
  for (const frame of frames) {
    let eventType = "";
    let dataStr = "";
    for (const line of frame.split("\n")) {
      if (line.startsWith("event:")) {
        eventType = line.slice(6).trim();
      } else if (line.startsWith("data:")) {
        dataStr = line.slice(5).trim();
      }
      // Lines starting with ":" are keep-alive comments — skip
    }
    if (eventType === "log" && dataStr) {
      try {
        lines.push(JSON.parse(dataStr) as LogLine);
      } catch {
        // malformed frame — ignore
      }
    }
  }
  return lines;
}

function LogRow({ item, index }: { item: LogLine; index: number }) {
  return (
    <div className={`${styles["log-row"]} ${index % 2 === 0 ? styles["log-row--alt"] : ""}`}>
      <span className={`${styles["log-level"]} ${levelClass(item.level)}`}>
        {item.level}
      </span>
      <span className={styles["log-ts"]}>{item.ts}</span>
      <span className={styles["log-logger"]}>{item.logger}</span>
      <span className={styles["log-msg"]}>{item.message}</span>
    </div>
  );
}

const AdminLogs: React.FC = () => {
  // ── File list ────────────────────────────────────────────────
  const [files, setFiles] = useState<LogFileInfo[]>([]);
  const [loadingFiles, setLoadingFiles] = useState(false);
  const [selectedFile, setSelectedFile] = useState<string>("");
  const [downloading, setDownloading] = useState<string | null>(null);

  // ── Filters ──────────────────────────────────────────────────
  const [q, setQ] = useState("");
  const [level, setLevel] = useState<LogLevel | "">("");
  const [limit, setLimit] = useState(200);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Log items ────────────────────────────────────────────────
  const [items, setItems] = useState<LogLine[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ── Live stream ───────────────────────────────────────────────
  const [isLive, setIsLive] = useState(false);
  const [liveConnected, setLiveConnected] = useState(false);
  const [liveError, setLiveError] = useState<string | null>(null);
  const [liveSourceFile, setLiveSourceFile] = useState("");
  const abortRef = useRef<AbortController | null>(null);

  // ── Load files on mount ──────────────────────────────────────
  useEffect(() => {
    let alive = true;
    setLoadingFiles(true);
    admin
      .getLogFiles()
      .then((data) => {
        if (!alive) return;
        setFiles(data.files || []);
        const current = data.files?.find((f) => f.is_current);
        if (current) setSelectedFile(current.name);
      })
      .catch(() => { })
      .finally(() => {
        if (!alive) return;
        setLoadingFiles(false);
      });
    return () => { alive = false; };
  }, []);

  // ── Fetch logs (paginated) ───────────────────────────────────
  const fetchLogs = useCallback(
    async (params: AdminLogsParams, append = false) => {
      if (append) {
        setLoadingMore(true);
      } else {
        setLoading(true);
        setError(null);
      }
      try {
        const data = await admin.getLogs({ direction: "backward", ...params });
        if (append) {
          setItems((prev) => [...prev, ...data.items]);
        } else {
          setItems(data.items);
        }
        setNextCursor(data.next_cursor);
      } catch (e: any) {
        const status = e?.response?.status;
        if (status === 403) setError("Admin access only.");
        else if (status === 400) setError(e?.response?.data?.detail || "Invalid request.");
        else if (status === 404) setError("Log file not found.");
        else setError("Failed to load logs.");
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    []
  );

  // ── Build params from current state ─────────────────────────
  const buildParams = useCallback(
    (cursor?: string): AdminLogsParams => {
      const p: AdminLogsParams = { limit, direction: "backward" };
      if (q.trim()) p.q = q.trim();
      if (level) p.level = level;
      if (selectedFile) p.file = selectedFile;
      if (cursor) p.cursor = cursor;
      return p;
    },
    [q, level, selectedFile, limit]
  );

  // ── Auto-reload when filters change (not during live) ────────
  useEffect(() => {
    if (isLive) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      fetchLogs(buildParams());
    }, q ? 400 : 0);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [q, level, selectedFile, limit, buildParams, fetchLogs, isLive]);

  // ── Stop live stream (teardown) ──────────────────────────────
  const stopStream = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setIsLive(false);
    setLiveConnected(false);
    setLiveError(null);
  }, []);

  // ── Start live SSE stream ────────────────────────────────────
  const startStream = useCallback(async () => {
    stopStream();

    const token = localStorage.getItem("access_token");
    const params = new URLSearchParams();
    if (q.trim()) params.set("q", q.trim());
    if (level) params.set("level", level);
    if (liveSourceFile.trim()) params.set("file", liveSourceFile.trim());
    const qs = params.toString() ? `?${params}` : "";
    const url = `${API_BASE_URL}/${Endpoints.admin.logStream}${qs}`;

    const controller = new AbortController();
    abortRef.current = controller;
    setIsLive(true);
    setLiveConnected(false);
    setLiveError(null);
    // Clear existing items so live view starts fresh
    setItems([]);
    setNextCursor(null);

    try {
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
        signal: controller.signal,
      });

      if (!res.ok) {
        const detail = await res.json().catch(() => ({}));
        setLiveError(detail?.detail || `Stream error ${res.status}`);
        setIsLive(false);
        return;
      }

      setLiveConnected(true);
      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (reader) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        // Process complete frames (ended by double newline)
        const splitAt = buffer.lastIndexOf("\n\n");
        if (splitAt === -1) continue;

        const toProcess = buffer.slice(0, splitAt + 2);
        buffer = buffer.slice(splitAt + 2);

        const newLines = parseSSEChunk(toProcess);
        if (newLines.length > 0) {
          // Prepend new lines (newest at top for consistency with historical view)
          setItems((prev) => [...newLines, ...prev]);
        }
      }
    } catch (e: any) {
      if (e?.name === "AbortError") return; // intentional stop
      setLiveError("Stream disconnected. Click Live to reconnect.");
    } finally {
      setIsLive(false);
      setLiveConnected(false);
      abortRef.current = null;
    }
  }, [q, level, liveSourceFile, stopStream]);

  // ── Stop stream on unmount ────────────────────────────────────
  useEffect(() => {
    return () => { abortRef.current?.abort(); };
  }, []);

  // ── Stop stream if live-relevant filters change ───────────────
  useEffect(() => {
    if (isLive) stopStream();
  }, [q, level, liveSourceFile]);

  const handleRefresh = () => {
    stopStream();
    fetchLogs(buildParams());
  };

  const handleLoadMore = () => {
    if (!nextCursor) return;
    fetchLogs(buildParams(nextCursor), true);
  };

  const handleDownload = async (fileName: string) => {
    setDownloading(fileName);
    try {
      await admin.downloadLogFile(fileName);
    } catch {
      // silent — browser download may still trigger
    } finally {
      setDownloading(null);
    }
  };

  const handleLiveToggle = () => {
    if (isLive) {
      stopStream();
      fetchLogs(buildParams());
    } else {
      startStream();
    }
  };

  return (
    <AdminLayout title="Logs" subtitle="Browse, stream, and download backend application logs.">
      <AdminTwoColumn sidebar={<aside className={styles["sidebar"]}>
          <div className={styles["sidebar-header"]}>Log Files</div>
          <div className={styles["sidebar-list"]}>
            {loadingFiles && (
              <div className={styles["sidebar-empty"]}>Loading…</div>
            )}
            {!loadingFiles && files.length === 0 && (
              <div className={styles["sidebar-empty"]}>No log files found.</div>
            )}

            {!loadingFiles && files.length > 0 && (
              <button
                className={`${styles["file-item"]} ${selectedFile === "" ? styles["file-item--active"] : ""}`}
                onClick={() => setSelectedFile("")}
              >
                <span className={styles["file-name"]}>All files</span>
              </button>
            )}

            {files.map((f) => (
              <button
                key={f.name}
                className={`${styles["file-item"]} ${selectedFile === f.name ? styles["file-item--active"] : ""}`}
                onClick={() => setSelectedFile(f.name)}
              >
                <span className={styles["file-name-row"]}>
                  <span className={styles["file-name"]}>{f.name}</span>
                  {f.is_current && (
                    <span className={styles["file-badge"]}>LIVE</span>
                  )}
                </span>
                <span className={styles["file-meta"]}>{formatBytes(f.size_bytes)}</span>
                <button
                  className={styles["download-btn"]}
                  title={`Download ${f.name}`}
                  disabled={downloading === f.name}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDownload(f.name);
                  }}
                >
                  {downloading === f.name ? "…" : "↓"}
                </button>
              </button>
            ))}
          </div>
        </aside>}>

        {/* ── Main panel ── */}
        <section className={styles["main"]}>
          {/* Filter bar */}
          <div className={styles["filter-bar"]}>
            <input
              className={styles["log-search"]}
              type="text"
              placeholder="Search logs…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
            <select
              className={styles["level-select"]}
              value={level}
              onChange={(e) => setLevel(e.target.value as LogLevel | "")}
            >
              {LEVELS.map((l) => (
                <option key={l.value} value={l.value}>
                  {l.label}
                </option>
              ))}
            </select>
            <select
              className={styles["limit-select"]}
              value={limit}
              onChange={(e) => setLimit(Number(e.target.value))}
              disabled={isLive}
            >
              {LIMITS.map((n) => (
                <option key={n} value={n}>
                  {n} lines
                </option>
              ))}
            </select>
            <button
              className={styles["refresh-btn"]}
              onClick={handleRefresh}
              disabled={loading || isLive}
            >
              ↺ Refresh
            </button>
            <input
              className={styles["live-source-input"]}
              type="text"
              placeholder="module filter (e.g. auth.py)"
              value={liveSourceFile}
              onChange={(e) => setLiveSourceFile(e.target.value)}
              title="Live stream only: filter by source Python module"
              disabled={isLive}
            />
            <button
              className={`${styles["live-btn"]} ${isLive ? styles["live-btn--active"] : ""}`}
              onClick={handleLiveToggle}
            >
              {isLive ? (
                <>
                  <span className={styles["live-dot"]} />
                  {liveConnected ? "Live" : "Connecting…"}
                </>
              ) : (
                "▶ Live"
              )}
            </button>
          </div>

          {/* Live error */}
          {liveError && (
            <div className={`${styles["message"]} ${styles["message--error"]}`}>
              {liveError}
              <button className={styles["retry-btn"]} onClick={startStream}>
                Reconnect
              </button>
            </div>
          )}

          {/* Fetch error */}
          {error && !isLive && (
            <div className={`${styles["message"]} ${styles["message--error"]}`}>
              {error}
              <button className={styles["retry-btn"]} onClick={handleRefresh}>
                Try again
              </button>
            </div>
          )}

          {/* Log list */}
          <div className={styles["log-list"]}>
            {loading && (
              <div className={styles["loading"]}>Loading logs…</div>
            )}

            {!loading && items.length === 0 && !error && !liveError && (
              <div className={styles["empty-state"]}>
                {isLive && !liveConnected
                  ? "Connecting to live stream…"
                  : "No log entries found."}
              </div>
            )}

            {items.map((item, i) => (
              <LogRow key={`${item.file}-${item.line_no}-${i}`} item={item} index={i} />
            ))}

            {/* Load more (only in historical mode) */}
            {!loading && !isLive && nextCursor && (
              <div className={styles["load-more-row"]}>
                <button
                  className={styles["ghost"]}
                  onClick={handleLoadMore}
                  disabled={loadingMore}
                >
                  {loadingMore ? "Loading…" : "Load More"}
                </button>
              </div>
            )}

            {!loading && !isLive && !nextCursor && items.length > 0 && (
              <div className={styles["end-marker"]}>— end of results —</div>
            )}
          </div>
        </section>
      </AdminTwoColumn>
    </AdminLayout>
  );
};

export default AdminLogs;
