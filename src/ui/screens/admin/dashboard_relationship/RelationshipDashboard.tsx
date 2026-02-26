import React, { useEffect, useMemo, useState } from "react";
import {
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";

import { apiClient } from "@/api/apis";
import { AdminServices } from "@/api/services/AdminServices";
import AdminLayout from "../AdminLayout";
import AdminTwoColumn from "../AdminTwoColumn";
import styles from "./RelationshipDashboard.module.css";

const admin = AdminServices(apiClient);

type UserRow = {
  id: number;
  username?: string | null;
  email?: string | null;
  full_name?: string | null;
};

type RelRow = {
  id: number;
  user_id: number;
  influencer_id: string;
  trust: number;
  closeness: number;
  attraction: number;
  safety: number;
  state: string;
  stage_points: number;
  sentiment_score: number;
  exclusive_agreed: boolean;
  girlfriend_confirmed: boolean;
  updated_at?: string | null;
  sentiment?: string;
};

type RelPatch = {
  user_id: number;
  influencer_id: string;
  trust?: number;
  closeness?: number;
  attraction?: number;
  safety?: number;
  state?: string;
  stage_points?: number;
  sentiment_score?: number;
  exclusive_agreed?: boolean;
  girlfriend_confirmed?: boolean;
  dtr_stage?: number;
  dtr_cooldown_until?: string;
  last_interaction_at?: string;
};

function clamp01to100(x: number) {
  const n = Number.isFinite(x) ? x : 0;
  return Math.max(0, Math.min(100, n));
}

function scoreLabel(v: number) {
  if (v >= 80) return "Excellent";
  if (v >= 60) return "Good";
  if (v >= 40) return "Okay";
  if (v >= 20) return "Low";
  return "Critical";
}

function stateBadge(state?: string) {
  const s = (state || "UNKNOWN").toUpperCase();
  const map: Record<string, { bg: string; fg: string; border: string }> = {
    GIRLFRIEND: {
      bg: "rgba(34,197,94,0.16)",
      fg: "#86efac",
      border: "rgba(34,197,94,0.28)",
    },
    DATING: {
      bg: "rgba(16,185,129,0.14)",
      fg: "#6ee7b7",
      border: "rgba(16,185,129,0.26)",
    },
    FLIRTING: {
      bg: "rgba(168,85,247,0.16)",
      fg: "#e9d5ff",
      border: "rgba(168,85,247,0.28)",
    },
    FRIENDS: {
      bg: "rgba(59,130,246,0.14)",
      fg: "#bfdbfe",
      border: "rgba(59,130,246,0.26)",
    },
    STRANGERS: {
      bg: "rgba(148,163,184,0.10)",
      fg: "#e2e8f0",
      border: "rgba(148,163,184,0.20)",
    },
    DISLIKE: {
      bg: "rgba(245,158,11,0.18)",
      fg: "#fde68a",
      border: "rgba(245,158,11,0.30)",
    },
    HATE: {
      bg: "rgba(239,68,68,0.22)",
      fg: "#fecaca",
      border: "rgba(239,68,68,0.35)",
    },
    STRAINED: {
      bg: "rgba(239,68,68,0.14)",
      fg: "#fecaca",
      border: "rgba(239,68,68,0.26)",
    },
    BROKEN: {
      bg: "rgba(148,163,184,0.10)",
      fg: "#e2e8f0",
      border: "rgba(148,163,184,0.20)",
    },
  };
  return (
    map[s] || {
      bg: "rgba(148,163,184,0.10)",
      fg: "#e2e8f0",
      border: "rgba(148,163,184,0.20)",
    }
  );
}

function Pill({
  children,
  tone,
}: {
  children: React.ReactNode;
  tone?: { bg: string; fg: string; border: string };
}) {
  const t = tone || {
    bg: "rgba(148,163,184,0.10)",
    fg: "#e2e8f0",
    border: "rgba(148,163,184,0.20)",
  };
  return (
    <span
      className={styles["pill"]}
      style={{
        background: t.bg,
        color: t.fg,
        border: `1px solid ${t.border}`,
      }}
    >
      {children}
    </span>
  );
}

function Panel({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section
      className={styles["panel"]}
    >
      <div className={styles["panel__title"]}>{title}</div>
      {children}
    </section>
  );
}

function MetricCard({
  title,
  value,
  hint,
}: {
  title: string;
  value: number;
  hint?: string;
}) {
  const v = clamp01to100(value);
  const pct = `${v.toFixed(0)}%`;
  return (
    <div className={styles["metric-card"]}>
      <div className={styles["metric-card__header"]}>
        <div>
          <div className={styles["metric-card__label"]}>{title}</div>
          <div className={styles["metric-card__value"]}>{pct}</div>
          <div className={styles["metric-card__hint"]}>
            {hint ?? scoreLabel(v)}
          </div>
        </div>

        <div className={styles["metric-card__bar-shell"]}>
          <div
            className={styles["metric-card__bar-fill"]}
            style={{ width: `${v}%` }}
          />
        </div>
      </div>
    </div>
  );
}

function useBreakpoints() {
  const [w, setW] = useState<number>(() =>
    typeof window !== "undefined" ? window.innerWidth : 1200
  );

  useEffect(() => {
    const onResize = () => setW(window.innerWidth);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const isMobile = w <= 640;
  const isTablet = w <= 1024;
  return { w, isMobile, isTablet };
}

export default function RelationshipDashboard() {
  const { isMobile } = useBreakpoints();

  const [users, setUsers] = useState<UserRow[]>([]);
  const [userQuery, setUserQuery] = useState("");
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);

  const [rels, setRels] = useState<RelRow[]>([]);
  const [selectedInfluencer, setSelectedInfluencer] = useState<string>("");

  const [loadingUsers, setLoadingUsers] = useState(false);
  const [loadingRels, setLoadingRels] = useState(false);
  const [errorUsers, setErrorUsers] = useState<string | null>(null);
  const [errorRels, setErrorRels] = useState<string | null>(null);

  const [edit, setEdit] = useState<RelPatch | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const selectedUser = useMemo(
    () => users.find((u) => u.id === selectedUserId) || null,
    [users, selectedUserId]
  );

  const selectedRel = useMemo(
    () => rels.find((r) => r.influencer_id === selectedInfluencer) || null,
    [rels, selectedInfluencer]
  );

  // Load users (AdminServices)
  useEffect(() => {
    let alive = true;
    setLoadingUsers(true);
    setErrorUsers(null);

    admin
      .getUsers(userQuery)
      .then((data) => {
        if (!alive) return;
        setUsers(data || []);
        setSelectedUserId((prev) => prev ?? data?.[0]?.id ?? null);
      })
      .catch((e) => {
        if (!alive) return;
        setUsers([]);
        setErrorUsers(e instanceof Error ? e.message : String(e));
      })
      .finally(() => {
        if (!alive) return;
        setLoadingUsers(false);
      });

    return () => {
      alive = false;
    };
  }, [userQuery]);

  // Load relationships (AdminServices)
  useEffect(() => {
    if (!selectedUserId) {
      setRels([]);
      setSelectedInfluencer("");
      return;
    }

    let alive = true;
    setLoadingRels(true);
    setErrorRels(null);

    admin
      .getRelationships(selectedUserId)
      .then((data) => {
        if (!alive) return;
        setRels(data || []);
        setSelectedInfluencer((prev) => prev || data?.[0]?.influencer_id || "");
      })
      .catch((e) => {
        if (!alive) return;
        setRels([]);
        setErrorRels(e instanceof Error ? e.message : String(e));
      })
      .finally(() => {
        if (!alive) return;
        setLoadingRels(false);
      });

    return () => {
      alive = false;
    };
  }, [selectedUserId]);

  // Keep influencer selection valid
  useEffect(() => {
    if (rels.length === 0) {
      setSelectedInfluencer("");
      return;
    }
    const ok = rels.some((r) => r.influencer_id === selectedInfluencer);
    if (!ok) setSelectedInfluencer(rels[0].influencer_id);
  }, [rels, selectedInfluencer]);

  const hydrateEditFromSelection = () => {
    if (!selectedRel) {
      setEdit(null);
      return;
    }
    setEdit({
      user_id: selectedRel.user_id,
      influencer_id: selectedRel.influencer_id,
      state: selectedRel.state,
      stage_points: selectedRel.stage_points,
      trust: selectedRel.trust,
      closeness: selectedRel.closeness,
      attraction: selectedRel.attraction,
      safety: selectedRel.safety,
      sentiment_score: selectedRel.sentiment_score,
      exclusive_agreed: selectedRel.exclusive_agreed,
      girlfriend_confirmed: selectedRel.girlfriend_confirmed,
    });
    setSaveError(null);
  };

  // Init editor when selection changes
  useEffect(() => {
    hydrateEditFromSelection();
  }, [selectedRel]);

  // Refresh helper
  const refreshSelected = async () => {
    if (!selectedUserId) return;
    try {
      const data = await admin.getRelationships(selectedUserId);
      setRels(data || []);
    } catch (e) {
      setErrorRels(e instanceof Error ? e.message : String(e));
    }
  };

  const isDirty = useMemo(() => {
    if (!selectedRel || !edit) return false;
    const fields: Array<keyof RelPatch> = [
      "state",
      "stage_points",
      "trust",
      "closeness",
      "attraction",
      "safety",
      "sentiment_score",
      "exclusive_agreed",
      "girlfriend_confirmed",
    ];
    return fields.some((key) => {
      const currentVal = (selectedRel as any)[key];
      const editVal = (edit as any)[key];
      return currentVal !== editVal;
    });
  }, [edit, selectedRel]);

  // Live refresh
  useEffect(() => {
    if (!selectedUserId || !selectedInfluencer) return;
    if (isDirty) return; // don't poll when there are unsaved changes
    const interval = setInterval(() => refreshSelected(), 5000);
    return () => clearInterval(interval);
  }, [selectedUserId, selectedInfluencer, isDirty]);

  // Save edits (AdminServices PATCH)
  const saveEdits = async () => {
    if (!edit) return;
    setSaving(true);
    setSaveError(null);
    try {
      await admin.patchRelationship(edit);
      await refreshSelected();
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  const resetEdits = () => {
    if (!selectedRel) return;
    setEdit({
      user_id: selectedRel.user_id,
      influencer_id: selectedRel.influencer_id,
      state: "STRANGERS",
      stage_points: 0,
      trust: 0,
      closeness: 0,
      attraction: 0,
      safety: 0,
      sentiment_score: 0,
      exclusive_agreed: false,
      girlfriend_confirmed: false,
    });
  };

  const badge = stateBadge(selectedRel?.state);

  const cardsCols = isMobile ? "1fr" : "repeat(4, 1fr)";
  const panelsCols = isMobile ? "1fr" : "1fr 1fr";
  const radarHeight = isMobile ? 240 : 300;

  const radarData = useMemo(() => {
    if (!selectedRel) return [];
    return [
      { metric: "Trust", value: Math.round(clamp01to100(selectedRel.trust)) },
      {
        metric: "Closeness",
        value: Math.round(clamp01to100(selectedRel.closeness)),
      },
      {
        metric: "Attraction",
        value: Math.round(clamp01to100(selectedRel.attraction)),
      },
      { metric: "Safety", value: Math.round(clamp01to100(selectedRel.safety)) },
    ];
  }, [selectedRel]);

  const Sidebar = (
    <aside className={styles["sidebar"]}>
      <div className={styles["sidebar-section"]}>
        <div className={styles["sidebar-title"]}>Relationship Admin</div>

        <input
          value={userQuery}
          onChange={(e) => setUserQuery(e.target.value)}
          placeholder="Search user (email/username)…"
          className={styles["search"]}
        />

        {loadingUsers && (
          <div className={styles["sidebar-hint"]}>Loading users…</div>
        )}
        {errorUsers && (
          <div className={styles["sidebar-error"]}>
            Users error: {errorUsers}
          </div>
        )}
      </div>

      <div
        className={styles["list"]}
        style={{ maxHeight: isMobile ? "40vh" : "45vh" }}
      >
        {users.map((u) => {
          const active = u.id === selectedUserId;
          return (
            <button
              key={u.id}
              onClick={() => {
                setSelectedUserId(u.id);
              }}
              className={`${styles["list-item"]} ${active ? styles["list-item--active"] : ""
                }`}
            >
              <div className={styles["list-item__title"]}>
                {u.username || u.full_name || `User #${u.id}`}
              </div>
              <div className={styles["list-item__subtitle"]}>
                {u.email || ""}
              </div>
            </button>
          );
        })}
        {!loadingUsers && users.length === 0 && (
          <div className={styles["sidebar-hint"]}>No users found.</div>
        )}
      </div>

      <div className={styles["sidebar-section"]}>
        <div className={styles["sidebar-title"]}>Influencers</div>

        {loadingRels && (
          <div className={styles["sidebar-hint"]}>Loading relationships…</div>
        )}
        {errorRels && (
          <div className={styles["sidebar-error"]}>
            Relationships error: {errorRels}
          </div>
        )}

        <div className={styles["influencer-list"]}>
          {rels.map((r) => {
            const active = r.influencer_id === selectedInfluencer;
            const b = stateBadge(r.state);
            return (
              <button
                key={r.influencer_id}
                onClick={() => {
                  setSelectedInfluencer(r.influencer_id);
                  }}
                className={`${styles["influencer"]} ${active ? styles["influencer--active"] : ""
                  }`}
              >
                <span className={styles["influencer__name"]}>
                  {r.influencer_id}
                </span>
                <span
                  className={styles["state-chip"]}
                  style={{
                    background: b.bg,
                    color: b.fg,
                    border: `1px solid ${b.border}`,
                  }}
                >
                  {r.state}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </aside>
  );

  return (
    <AdminLayout
      title="Relationship Dashboard"
      subtitle="Monitor and adjust user ↔ influencer relationships with live refresh every 5s."
      headerRight={
        <button
          className={styles["refresh"]}
          onClick={refreshSelected}
          disabled={!selectedUserId || saving || loadingRels}
        >
          {loadingRels ? "Loading…" : "Refresh"}
        </button>
      }
    >
      <AdminTwoColumn sidebar={Sidebar} sidebarWidth={320}>
        <main className={styles["main"]}>
          <div className={styles["header"]}>
            <div>
              <div className={styles["eyebrow"]}>Relationship Dashboard</div>
              <div className={styles["title"]}>
                {selectedUser
                  ? `${selectedUser.username ||
                  selectedUser.full_name ||
                  `User #${selectedUser.id}`
                  }`
                  : "Select a user"}
                {selectedRel ? ` • ${selectedRel.influencer_id}` : ""}
              </div>
              <div className={styles["subline"]}>
                {selectedRel?.updated_at
                  ? `Updated: ${new Date(
                    selectedRel.updated_at
                  ).toLocaleString()}`
                  : ""}
              </div>
            </div>

            <div className={styles["controls"]}>
              {selectedRel && edit ? (
                <>
                  <Pill tone={badge}>Stage</Pill>

                  <select
                    value={edit.state || "STRANGERS"}
                    onChange={(e) =>
                      setEdit((p) =>
                        p ? { ...p, state: e.target.value } : p
                      )
                    }
                    className={styles["select"]}
                  >
                    {[
                      "HATE",
                      "DISLIKE",
                      "STRANGERS",
                      "FRIENDS",
                      "FLIRTING",
                      "DATING",
                      "GIRLFRIEND",
                    ].map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>

                  <label className={styles["checkbox"]}>
                    <input
                      type="checkbox"
                      checked={!!edit.exclusive_agreed}
                      onChange={(e) =>
                        setEdit((p) =>
                          p
                            ? { ...p, exclusive_agreed: e.target.checked }
                            : p
                        )
                      }
                    />
                    <span>Exclusive</span>
                  </label>

                  <label className={styles["checkbox"]}>
                    <input
                      type="checkbox"
                      checked={!!edit.girlfriend_confirmed}
                      onChange={(e) =>
                        setEdit((p) =>
                          p
                            ? {
                              ...p,
                              girlfriend_confirmed: e.target.checked,
                            }
                            : p
                        )
                      }
                    />
                    <span>Girlfriend</span>
                  </label>

                  {isDirty && (
                    <Pill
                      tone={{
                        bg: "rgba(245,158,11,0.12)",
                        fg: "#fcd34d",
                        border: "rgba(245,158,11,0.4)",
                      }}
                    >
                      Unsaved changes
                    </Pill>
                  )}

                  <div className={styles["button-row"]}>
                    <button
                      onClick={resetEdits}
                      disabled={saving}
                      className={styles["ghost"]}
                    >
                      Reset
                    </button>
                    <button
                      onClick={saveEdits}
                      disabled={saving}
                      className={`${styles["primary"]} ${isDirty ? styles["primary--warning"] : ""
                        }`}
                    >
                      {saving ? "Saving…" : isDirty ? "Save changes" : "Save"}
                    </button>
                  </div>

                  {saveError && (
                    <Pill
                      tone={{
                        bg: "rgba(239,68,68,0.14)",
                        fg: "#fecaca",
                        border: "rgba(239,68,68,0.26)",
                      }}
                    >
                      Save error
                    </Pill>
                  )}
                </>
              ) : (
                <Pill>Select a user + influencer</Pill>
              )}
            </div>
          </div>

          {selectedRel && edit && (
            <div
              className={styles["slider-grid"]}
              style={{
                gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr",
              }}
            >
              {(
                [
                  ["trust", "Trust", 0, 100],
                  ["closeness", "Closeness", 0, 100],
                  ["attraction", "Attraction", 0, 100],
                  ["safety", "Safety", 0, 100],
                  ["stage_points", "Stage Points", 0, 100],
                  ["sentiment_score", "Sentiment Score", -100, 100],
                ] as const
              ).map(([key, label, min, max]) => (
                <div key={key} className={styles["slider-card"]}>
                  <div className={styles["slider-card__label"]}>{label}</div>
                  <input
                    type="range"
                    min={min}
                    max={max}
                    value={Number((edit as any)[key] ?? 0)}
                    onChange={(e) =>
                      setEdit((p) =>
                        p ? { ...p, [key]: Number(e.target.value) } : p
                      )
                    }
                    className={styles["slider"]}
                  />
                  <div className={styles["slider-card__value"]}>
                    {Number((edit as any)[key] ?? 0).toFixed(0)}
                  </div>
                </div>
              ))}
            </div>
          )}

          <div
            className={styles["metrics"]}
            style={{ gridTemplateColumns: cardsCols }}
          >
            <MetricCard title="Trust" value={selectedRel?.trust ?? 0} />
            <MetricCard title="Closeness" value={selectedRel?.closeness ?? 0} />
            <MetricCard
              title="Attraction"
              value={selectedRel?.attraction ?? 0}
            />
            <MetricCard title="Safety" value={selectedRel?.safety ?? 0} />
          </div>

          <div
            className={styles["panels"]}
            style={{ gridTemplateColumns: panelsCols }}
          >
            <Panel title="Selected influencer — radar">
              {selectedRel ? (
                <div className={styles["radar"]} style={{ height: radarHeight }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <RadarChart data={radarData}>
                      <PolarGrid />
                      <PolarAngleAxis dataKey="metric" />
                      <PolarRadiusAxis domain={[0, 100]} />
                      <Radar dataKey="value" />
                      <Tooltip />
                    </RadarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className={styles["panel-empty"]}>
                  Select a user and influencer to see metrics.
                </div>
              )}
            </Panel>

            <Panel title="Relationships summary">
              {rels.length ? (
                <div className={styles["summary"]}>
                  <div className={styles["summary__hint"]}>
                    {rels.length} influencer relationship(s) for this user.
                  </div>
                  <div
                    className={styles["summary__grid"]}
                    style={{ gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr" }}
                  >
                    <MetricCard
                      title="Avg Trust"
                      value={rels.reduce((a, r) => a + r.trust, 0) / rels.length}
                    />
                    <MetricCard
                      title="Avg Safety"
                      value={
                        rels.reduce((a, r) => a + r.safety, 0) / rels.length
                      }
                    />
                  </div>
                </div>
              ) : (
                <div className={styles["panel-empty"]}>
                  No relationships found for this user.
                </div>
              )}
            </Panel>
          </div>
        </main>
      </AdminTwoColumn>
    </AdminLayout>
  );
}
