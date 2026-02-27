import React, { useCallback, useEffect, useRef, useState } from "react";
import { apiClient } from "@/api/apis";
import {
  AdminServices,
  AdminUserRow,
  AdminChatInfoResponse,
  AdminClearHistoryResponse,
  HistoryClearMode,
  ChatInfoStats,
} from "@/api/services/AdminServices";
import { InfluencerServices } from "@/api/services/InfluencerService";
import { InfluencerResponse } from "@/api/models/influencers";
import AdminLayout from "@/ui/screens/admin/AdminLayout";
import AdminTwoColumn from "@/ui/screens/admin/AdminTwoColumn";
import styles from "./AdminChatHistory.module.css";

const admin = AdminServices(apiClient);
const influencerSvc = InfluencerServices(apiClient);

const MODES: { value: HistoryClearMode; label: string }[] = [
  { value: "both", label: "Both" },
  { value: "normal", label: "Normal" },
  { value: "adult", label: "Adult" },
];

function StatCard({ label, stats }: { label: string; stats: ChatInfoStats }) {
  return (
    <div className={styles["stat-card"]}>
      <div className={styles["stat-card-title"]}>{label}</div>
      <div className={styles["stat-rows"]}>
        <div className={styles["stat-row"]}>
          <span className={styles["stat-label"]}>Chats</span>
          <span className={styles["stat-value"]}>{stats.chats_count}</span>
        </div>
        <div className={styles["stat-row"]}>
          <span className={styles["stat-label"]}>Messages</span>
          <span className={styles["stat-value"]}>{stats.messages_count}</span>
        </div>
        <div className={styles["stat-row"]}>
          <span className={styles["stat-label"]}>Memories</span>
          <span className={styles["stat-value"]}>{stats.memories_count}</span>
        </div>
        <div className={styles["stat-row"]}>
          <span className={styles["stat-label"]}>Calls</span>
          <span className={styles["stat-value"]}>{stats.calls_count}</span>
        </div>
      </div>
    </div>
  );
}

const AdminChatHistory: React.FC = () => {
  // ── Influencer list ─────────────────────────────────────────
  const [influencers, setInfluencers] = useState<InfluencerResponse[]>([]);
  const [loadingInfluencers, setLoadingInfluencers] = useState(false);
  const [selectedInfluencer, setSelectedInfluencer] = useState<InfluencerResponse | null>(null);

  // ── User search / list ───────────────────────────────────────
  const [userSearch, setUserSearch] = useState("");
  const [users, setUsers] = useState<AdminUserRow[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [selectedUser, setSelectedUser] = useState<AdminUserRow | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Stats ────────────────────────────────────────────────────
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [chatInfo, setChatInfo] = useState<AdminChatInfoResponse | null>(null);
  const [loadingInfo, setLoadingInfo] = useState(false);
  const [infoError, setInfoError] = useState<string | null>(null);

  // ── Clear history ────────────────────────────────────────────
  const [clearMode, setClearMode] = useState<HistoryClearMode>("both");
  const [confirmClear, setConfirmClear] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [clearResult, setClearResult] = useState<AdminClearHistoryResponse | null>(null);
  const [clearError, setClearError] = useState<string | null>(null);
  const [alreadyCleared, setAlreadyCleared] = useState(false);

  // ── Load influencers on mount ────────────────────────────────
  useEffect(() => {
    let alive = true;
    setLoadingInfluencers(true);
    influencerSvc
      .getInfluencers()
      .then((data) => {
        if (!alive) return;
        setInfluencers(data || []);
      })
      .catch(() => {})
      .finally(() => {
        if (!alive) return;
        setLoadingInfluencers(false);
      });
    return () => { alive = false; };
  }, []);

  // ── Debounced user search ────────────────────────────────────
  const searchUsers = useCallback((q: string) => {
    setLoadingUsers(true);
    admin
      .getUsers(q || undefined)
      .then((data) => setUsers(data || []))
      .catch(() => setUsers([]))
      .finally(() => setLoadingUsers(false));
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => searchUsers(userSearch), 350);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [userSearch, searchUsers]);

  // ── Reset pair state when selection changes ──────────────────
  useEffect(() => {
    setChatInfo(null);
    setInfoError(null);
    setClearResult(null);
    setClearError(null);
    setConfirmClear(false);
    setAlreadyCleared(false);
  }, [selectedUser, selectedInfluencer]);

  // ── Load stats ───────────────────────────────────────────────
  const handleLoadStats = async () => {
    if (!selectedUser || !selectedInfluencer) return;
    setLoadingInfo(true);
    setInfoError(null);
    setChatInfo(null);
    try {
      const data = await admin.getChatInfo(
        selectedInfluencer.id,
        selectedUser.id,
        from || undefined,
        to || undefined
      );
      setChatInfo(data);
    } catch (e: any) {
      const status = e?.response?.status;
      if (status === 403) setInfoError("Admin access only.");
      else if (status === 400) setInfoError(e?.response?.data?.detail || "Invalid date range.");
      else setInfoError("Failed to fetch stats.");
    } finally {
      setLoadingInfo(false);
    }
  };

  // ── Clear history ────────────────────────────────────────────
  const handleClear = async () => {
    if (!selectedUser || !selectedInfluencer) return;
    setClearing(true);
    setClearError(null);
    setClearResult(null);
    setAlreadyCleared(false);
    try {
      const data = await admin.clearPairHistory(
        selectedInfluencer.id,
        selectedUser.id,
        clearMode
      );
      setClearResult(data);
      setConfirmClear(false);
      // Reload stats to reflect 0 counts
      setChatInfo(null);
    } catch (e: any) {
      const status = e?.response?.status;
      if (status === 404) {
        setAlreadyCleared(true);
        setConfirmClear(false);
      } else if (status === 403) {
        setClearError("Admin access only.");
        setConfirmClear(false);
      } else {
        setClearError("Failed to clear history. Try again.");
      }
    } finally {
      setClearing(false);
    }
  };

  const userLabel = (u: AdminUserRow) =>
    u.username || u.email || u.full_name || `User #${u.id}`;

  const pairReady = !!selectedUser && !!selectedInfluencer;

  return (
    <AdminLayout
      title="Chat History"
      subtitle="View pair stats and clear chat history for a user–influencer pair."
    >
      <AdminTwoColumn sidebar={<aside className={styles["sidebar"]}>
          {/* Users section */}
          <div className={styles["sidebar-section-header"]}>Users</div>
          <div className={styles["sidebar-search-wrap"]}>
            <input
              className={styles["sidebar-search"]}
              type="text"
              placeholder="Search by name or email…"
              value={userSearch}
              onChange={(e) => {
                setUserSearch(e.target.value);
                setSelectedUser(null);
              }}
            />
          </div>
          <div className={styles["sidebar-list"]} style={{ maxHeight: 220 }}>
            {loadingUsers && (
              <div className={styles["sidebar-empty"]}>Searching…</div>
            )}
            {!loadingUsers && users.length === 0 && (
              <div className={styles["sidebar-empty"]}>No users found.</div>
            )}
            {!loadingUsers &&
              users.map((u) => (
                <button
                  key={u.id}
                  className={`${styles["sidebar-item"]} ${
                    selectedUser?.id === u.id ? styles["sidebar-item--active"] : ""
                  }`}
                  onClick={() => setSelectedUser(u)}
                >
                  <span className={styles["sidebar-item-name"]}>{userLabel(u)}</span>
                  <span className={styles["sidebar-item-meta"]}>#{u.id}</span>
                </button>
              ))}
          </div>

          {/* Influencers section */}
          <div className={styles["sidebar-divider"]} />
          <div className={styles["sidebar-section-header"]}>Influencers</div>
          <div className={styles["sidebar-list"]} style={{ flex: 1 }}>
            {loadingInfluencers && (
              <div className={styles["sidebar-empty"]}>Loading…</div>
            )}
            {!loadingInfluencers && influencers.length === 0 && (
              <div className={styles["sidebar-empty"]}>No influencers found.</div>
            )}
            {influencers.map((inf) => (
              <button
                key={inf.id}
                className={`${styles["sidebar-item"]} ${
                  selectedInfluencer?.id === inf.id ? styles["sidebar-item--active"] : ""
                }`}
                onClick={() => setSelectedInfluencer(inf)}
              >
                {inf.display_name || inf.id}
              </button>
            ))}
          </div>
        </aside>}>
        <section className={styles["main"]}>
          {!pairReady && (
            <div className={styles["panel-placeholder"]}>
              Select a user and an influencer to view stats and manage history.
            </div>
          )}

          {pairReady && (
            <>
              {/* Pair header */}
              <div className={styles["panel-header"]}>
                <div className={styles["panel-title"]}>
                  {userLabel(selectedUser!)}
                  <span className={styles["pair-sep"]}> × </span>
                  {selectedInfluencer!.display_name || selectedInfluencer!.id}
                </div>
                <div className={styles["pair-ids"]}>
                  User ID: {selectedUser!.id} · Influencer: {selectedInfluencer!.id}
                </div>
              </div>

              {/* Date range */}
              <div className={styles["date-row"]}>
                <div className={styles["date-field"]}>
                  <label className={styles["date-label"]}>From</label>
                  <input
                    type="datetime-local"
                    className={styles["date-input"]}
                    value={from}
                    onChange={(e) => setFrom(e.target.value)}
                  />
                </div>
                <div className={styles["date-field"]}>
                  <label className={styles["date-label"]}>To</label>
                  <input
                    type="datetime-local"
                    className={styles["date-input"]}
                    value={to}
                    onChange={(e) => setTo(e.target.value)}
                  />
                </div>
                <button
                  className={styles["primary"]}
                  onClick={handleLoadStats}
                  disabled={loadingInfo}
                >
                  {loadingInfo ? "Loading…" : "Load Stats"}
                </button>
              </div>

              {/* Info error */}
              {infoError && (
                <div className={`${styles["message"]} ${styles["message--error"]}`}>
                  {infoError}
                </div>
              )}

              {/* Stats grid */}
              {chatInfo && (
                <div className={styles["stats-grid"]}>
                  <StatCard label="Normal" stats={chatInfo.normal} />
                  <StatCard label="Adult" stats={chatInfo.adult} />
                  <StatCard label="Total" stats={chatInfo.total} />
                </div>
              )}

              {/* Clear section */}
              <div className={styles["section-divider"]}>
                <span className={styles["section-divider-label"]}>Clear History</span>
              </div>

              {/* Already cleared info */}
              {alreadyCleared && (
                <div className={`${styles["message"]} ${styles["message--info"]}`}>
                  No history found — this pair is already cleared.
                </div>
              )}

              {/* Clear result */}
              {clearResult && (
                <div className={styles["result-panel"]}>
                  <div className={styles["result-title"]}>History Cleared</div>
                  <div className={styles["result-grid"]}>
                    <div className={styles["result-row"]}>
                      <span>Mode</span>
                      <span className={styles["result-val"]}>{clearResult.mode}</span>
                    </div>
                    <div className={styles["result-row"]}>
                      <span>Chats deleted</span>
                      <span className={styles["result-val"]}>
                        {clearResult.chats_deleted + clearResult.chats_18_deleted}
                      </span>
                    </div>
                    <div className={styles["result-row"]}>
                      <span>Messages deleted</span>
                      <span className={styles["result-val"]}>
                        {clearResult.messages_deleted + clearResult.messages_18_deleted}
                      </span>
                    </div>
                    <div className={styles["result-row"]}>
                      <span>Memories deleted</span>
                      <span className={styles["result-val"]}>{clearResult.memories_deleted}</span>
                    </div>
                    <div className={styles["result-row"]}>
                      <span>Call records deleted</span>
                      <span className={styles["result-val"]}>{clearResult.call_records_deleted}</span>
                    </div>
                    <div className={styles["result-row"]}>
                      <span>Redis keys cleared</span>
                      <span className={styles["result-val"]}>{clearResult.redis_keys_cleared.length}</span>
                    </div>
                    {clearResult.redis_clear_failures.length > 0 && (
                      <div className={`${styles["result-row"]} ${styles["result-row--warn"]}`}>
                        <span>Redis failures</span>
                        <span className={styles["result-val"]}>
                          {clearResult.redis_clear_failures.join(", ")}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Mode tabs + clear button */}
              {!clearResult && (
                <>
                  <div className={styles["mode-row"]}>
                    <span className={styles["mode-label"]}>Mode:</span>
                    <div className={styles["mode-tabs"]}>
                      {MODES.map((m) => (
                        <button
                          key={m.value}
                          className={`${styles["mode-tab"]} ${
                            clearMode === m.value ? styles["mode-tab--active"] : ""
                          }`}
                          onClick={() => {
                            setClearMode(m.value);
                            setConfirmClear(false);
                          }}
                          disabled={clearing}
                        >
                          {m.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {clearError && (
                    <div className={`${styles["message"]} ${styles["message--error"]}`}>
                      {clearError}
                    </div>
                  )}

                  {!confirmClear && (
                    <div className={styles["button-row"]}>
                      <button
                        className={styles["danger"]}
                        onClick={() => {
                          setClearError(null);
                          setConfirmClear(true);
                        }}
                        disabled={clearing}
                      >
                        Clear History
                      </button>
                    </div>
                  )}

                  {confirmClear && (
                    <div className={styles["confirm-row"]}>
                      <span className={styles["confirm-label"]}>
                        Delete <strong>{clearMode}</strong> history for this pair? This cannot be undone.
                      </span>
                      <button
                        className={styles["danger"]}
                        onClick={handleClear}
                        disabled={clearing}
                      >
                        {clearing ? "Clearing…" : "Confirm Clear"}
                      </button>
                      <button
                        className={styles["ghost"]}
                        onClick={() => setConfirmClear(false)}
                        disabled={clearing}
                      >
                        Cancel
                      </button>
                    </div>
                  )}
                </>
              )}

              {/* After clear, offer reload */}
              {clearResult && (
                <div className={styles["button-row"]}>
                  <button
                    className={styles["ghost"]}
                    onClick={() => {
                      setClearResult(null);
                      setClearError(null);
                      setAlreadyCleared(false);
                    }}
                  >
                    Clear Again
                  </button>
                  <button
                    className={styles["primary"]}
                    onClick={handleLoadStats}
                    disabled={loadingInfo}
                  >
                    {loadingInfo ? "Loading…" : "Reload Stats"}
                  </button>
                </div>
              )}
            </>
          )}
        </section>
      </AdminTwoColumn>
    </AdminLayout>
  );
};

export default AdminChatHistory;
