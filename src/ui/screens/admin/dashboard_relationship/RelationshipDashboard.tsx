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

function sentimentLabel(score: number) {
  if (score <= -60) return "HATE";
  if (score <= -20) return "DISLIKE";
  if (score < 20) return "NEUTRAL";
  if (score < 50) return "FRIENDLY";
  if (score < 75) return "FLIRTY";
  return "IN_LOVE";
}

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
    TALKING: {
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
      style={{
        padding: "6px 10px",
        borderRadius: 999,
        background: t.bg,
        color: t.fg,
        border: `1px solid ${t.border}`,
        fontWeight: 800,
        fontSize: 12,
        whiteSpace: "nowrap",
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
      style={{
        borderRadius: 16,
        border: "1px solid rgba(255,255,255,0.08)",
        background: "rgba(0,0,0,0.18)",
        padding: 12,
        overflow: "hidden",
      }}
    >
      <div
        style={{
          fontWeight: 900,
          fontSize: 13,
          marginBottom: 10,
          opacity: 0.95,
        }}
      >
        {title}
      </div>
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
    <div
      style={{
        border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: 16,
        padding: 14,
        background: "rgba(255,255,255,0.03)",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 12,
          alignItems: "flex-start",
        }}
      >
        <div>
          <div style={{ fontSize: 12, opacity: 0.82 }}>{title}</div>
          <div style={{ fontSize: 22, fontWeight: 900, marginTop: 6 }}>
            {pct}
          </div>
          <div style={{ fontSize: 12, opacity: 0.72, marginTop: 4 }}>
            {hint ?? scoreLabel(v)}
          </div>
        </div>

        <div style={{ width: 90 }}>
          <div
            style={{
              height: 8,
              borderRadius: 999,
              background: "rgba(255,255,255,0.08)",
              overflow: "hidden",
              marginTop: 8,
            }}
          >
            <div
              style={{
                width: `${v}%`,
                height: "100%",
                background: "rgba(255,255,255,0.78)",
              }}
            />
          </div>
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
  const { isMobile, isTablet } = useBreakpoints();
  const [showSidebarMobile, setShowSidebarMobile] = useState(false);

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

  // Init editor when selection changes
  useEffect(() => {
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

  // Live refresh
  useEffect(() => {
    if (!selectedUserId || !selectedInfluencer) return;
    const interval = setInterval(() => refreshSelected(), 5000);
    return () => clearInterval(interval);
  }, [selectedUserId, selectedInfluencer]);

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

  const badge = stateBadge(selectedRel?.state);

  const rootGridCols = isTablet ? "1fr" : "320px 1fr";
  const cardsCols = isMobile ? "1fr" : isTablet ? "1fr 1fr" : "repeat(4, 1fr)";
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
    <aside
      style={{
        border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: 16,
        background: "rgba(255,255,255,0.03)",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          padding: 14,
          borderBottom: "1px solid rgba(255,255,255,0.08)",
        }}
      >
        <div style={{ fontWeight: 900, fontSize: 14 }}>Relationship Admin</div>

        <input
          value={userQuery}
          onChange={(e) => setUserQuery(e.target.value)}
          placeholder="Search user (email/username)…"
          style={{
            marginTop: 12,
            width: "100%",
            padding: "12px 12px",
            borderRadius: 12,
            border: "1px solid rgba(255,255,255,0.12)",
            background: "rgba(0,0,0,0.25)",
            color: "rgba(255,255,255,0.9)",
            outline: "none",
          }}
        />

        {loadingUsers && (
          <div style={{ marginTop: 10, fontSize: 12, opacity: 0.8 }}>
            Loading users…
          </div>
        )}
        {errorUsers && (
          <div style={{ marginTop: 10, fontSize: 12, color: "#ffb4b4" }}>
            Users error: {errorUsers}
          </div>
        )}
      </div>

      <div style={{ maxHeight: isMobile ? "40vh" : "45vh", overflow: "auto" }}>
        {users.map((u) => {
          const active = u.id === selectedUserId;
          return (
            <button
              key={u.id}
              onClick={() => {
                setSelectedUserId(u.id);
                if (isMobile) setShowSidebarMobile(false);
              }}
              style={{
                width: "100%",
                textAlign: "left",
                padding: 12,
                minHeight: 44,
                border: "none",
                borderBottom: "1px solid rgba(255,255,255,0.06)",
                background: active ? "rgba(255,255,255,0.08)" : "transparent",
                color: "rgba(255,255,255,0.92)",
                cursor: "pointer",
              }}
            >
              <div style={{ fontWeight: 800, fontSize: 13 }}>
                {u.username || u.full_name || `User #${u.id}`}
              </div>
              <div style={{ opacity: 0.75, fontSize: 12 }}>{u.email || ""}</div>
            </button>
          );
        })}
        {!loadingUsers && users.length === 0 && (
          <div style={{ padding: 12, opacity: 0.8 }}>No users found.</div>
        )}
      </div>

      <div
        style={{ padding: 14, borderTop: "1px solid rgba(255,255,255,0.08)" }}
      >
        <div style={{ fontWeight: 900, fontSize: 13 }}>Influencers</div>

        {loadingRels && (
          <div style={{ marginTop: 10, fontSize: 12, opacity: 0.8 }}>
            Loading relationships…
          </div>
        )}
        {errorRels && (
          <div style={{ marginTop: 10, fontSize: 12, color: "#ffb4b4" }}>
            Relationships error: {errorRels}
          </div>
        )}

        <div
          style={{
            marginTop: 10,
            display: "flex",
            flexDirection: "column",
            gap: 8,
          }}
        >
          {rels.map((r) => {
            const active = r.influencer_id === selectedInfluencer;
            const b = stateBadge(r.state);
            return (
              <button
                key={r.influencer_id}
                onClick={() => {
                  setSelectedInfluencer(r.influencer_id);
                  if (isMobile) setShowSidebarMobile(false);
                }}
                style={{
                  width: "100%",
                  textAlign: "left",
                  padding: 12,
                  minHeight: 44,
                  borderRadius: 12,
                  border: "1px solid rgba(255,255,255,0.08)",
                  background: active ? "rgba(255,255,255,0.08)" : "transparent",
                  color: "rgba(255,255,255,0.92)",
                  cursor: "pointer",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <span style={{ fontWeight: 800 }}>{r.influencer_id}</span>
                <span
                  style={{
                    fontSize: 11,
                    padding: "4px 8px",
                    borderRadius: 999,
                    background: b.bg,
                    color: b.fg,
                    border: `1px solid ${b.border}`,
                    whiteSpace: "nowrap",
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
    <div
      style={{
        display: "grid",
        gridTemplateColumns: rootGridCols,
        minHeight: "calc(100vh - 48px)",
        gap: 16,
        padding: 16,
        color: "rgba(255,255,255,0.92)",
      }}
    >
      {isMobile && (
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <button
            onClick={() => setShowSidebarMobile((v) => !v)}
            style={{
              padding: "12px 14px",
              borderRadius: 12,
              border: "1px solid rgba(255,255,255,0.12)",
              background: "rgba(255,255,255,0.05)",
              color: "rgba(255,255,255,0.92)",
              fontWeight: 800,
              cursor: "pointer",
              flex: 1,
            }}
          >
            ☰ Select User / Influencer
          </button>

          <Pill tone={selectedRel ? badge : undefined}>
            {selectedRel?.state || "—"}
          </Pill>
        </div>
      )}

      {!isMobile && Sidebar}
      {isMobile && showSidebarMobile && Sidebar}

      <main
        style={{
          border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: 16,
          background: "rgba(255,255,255,0.03)",
          padding: 16,
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: 12,
            flexWrap: "wrap",
          }}
        >
          <div>
            <div style={{ opacity: 0.72, fontSize: 12 }}>
              Relationship Dashboard
            </div>
            <div
              style={{
                fontSize: isMobile ? 18 : 22,
                fontWeight: 950,
                marginTop: 6,
              }}
            >
              {selectedUser
                ? `${
                    selectedUser.username ||
                    selectedUser.full_name ||
                    `User #${selectedUser.id}`
                  }`
                : "Select a user"}
              {selectedRel ? ` • ${selectedRel.influencer_id}` : ""}
            </div>
            <div style={{ opacity: 0.7, fontSize: 12, marginTop: 6 }}>
              {selectedRel?.updated_at
                ? `Updated: ${new Date(
                    selectedRel.updated_at
                  ).toLocaleString()}`
                : ""}
            </div>
          </div>

          {/* Editable */}
          <div
            style={{
              display: "flex",
              gap: 10,
              flexWrap: "wrap",
              alignItems: "center",
            }}
          >
            {selectedRel && edit ? (
              <>
                <Pill tone={badge}>Stage</Pill>

                <select
                  value={edit.state || "STRANGERS"}
                  onChange={(e) =>
                    setEdit((p) => (p ? { ...p, state: e.target.value } : p))
                  }
                  style={{
                    padding: "8px 10px",
                    borderRadius: 12,
                    border: "1px solid rgba(255,255,255,0.12)",
                    background: "rgba(0,0,0,0.25)",
                    color: "rgba(255,255,255,0.92)",
                    fontWeight: 800,
                  }}
                >
                  {[
                    "HATE",
                    "DISLIKE",
                    "STRANGERS",
                    "TALKING",
                    "FLIRTING",
                    "DATING",
                    "GIRLFRIEND",
                  ].map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>

                <Pill>
                  Sentiment: {sentimentLabel(edit.sentiment_score ?? 0)}
                </Pill>

                <label
                  style={{ display: "flex", gap: 8, alignItems: "center" }}
                >
                  <input
                    type="checkbox"
                    checked={!!edit.exclusive_agreed}
                    onChange={(e) =>
                      setEdit((p) =>
                        p ? { ...p, exclusive_agreed: e.target.checked } : p
                      )
                    }
                  />
                  <span style={{ fontSize: 12, fontWeight: 800 }}>
                    Exclusive
                  </span>
                </label>

                <label
                  style={{ display: "flex", gap: 8, alignItems: "center" }}
                >
                  <input
                    type="checkbox"
                    checked={!!edit.girlfriend_confirmed}
                    onChange={(e) =>
                      setEdit((p) =>
                        p ? { ...p, girlfriend_confirmed: e.target.checked } : p
                      )
                    }
                  />
                  <span style={{ fontSize: 12, fontWeight: 800 }}>
                    Girlfriend
                  </span>
                </label>

                <button
                  onClick={saveEdits}
                  disabled={saving}
                  style={{
                    padding: "10px 12px",
                    borderRadius: 12,
                    border: "1px solid rgba(255,255,255,0.12)",
                    background: saving
                      ? "rgba(255,255,255,0.05)"
                      : "rgba(255,255,255,0.10)",
                    color: "rgba(255,255,255,0.92)",
                    fontWeight: 900,
                    cursor: saving ? "default" : "pointer",
                  }}
                >
                  {saving ? "Saving…" : "Save"}
                </button>

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

        {/* Sliders */}
        {selectedRel && edit && (
          <div
            style={{
              marginTop: 12,
              display: "grid",
              gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr",
              gap: 12,
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
              <div
                key={key}
                style={{
                  padding: 12,
                  borderRadius: 14,
                  border: "1px solid rgba(255,255,255,0.08)",
                  background: "rgba(0,0,0,0.12)",
                }}
              >
                <div style={{ fontSize: 12, opacity: 0.8, fontWeight: 800 }}>
                  {label}
                </div>
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
                  style={{ width: "100%", marginTop: 8 }}
                />
                <div style={{ marginTop: 6, fontWeight: 900 }}>
                  {Number((edit as any)[key] ?? 0).toFixed(0)}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Metrics */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: cardsCols,
            gap: 12,
            marginTop: 16,
          }}
        >
          <MetricCard title="Trust" value={selectedRel?.trust ?? 0} />
          <MetricCard title="Closeness" value={selectedRel?.closeness ?? 0} />
          <MetricCard title="Attraction" value={selectedRel?.attraction ?? 0} />
          <MetricCard title="Safety" value={selectedRel?.safety ?? 0} />
        </div>

        {/* Panels */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: panelsCols,
            gap: 16,
            marginTop: 16,
          }}
        >
          <Panel title="Selected influencer — radar">
            {selectedRel ? (
              <div style={{ height: radarHeight }}>
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
              <div style={{ padding: 10, opacity: 0.8, fontSize: 12 }}>
                Select a user and influencer to see metrics.
              </div>
            )}
          </Panel>

          <Panel title="Relationships summary">
            {rels.length ? (
              <div
                style={{ display: "flex", flexDirection: "column", gap: 10 }}
              >
                <div style={{ fontSize: 12, opacity: 0.8 }}>
                  {rels.length} influencer relationship(s) for this user.
                </div>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr",
                    gap: 10,
                  }}
                >
                  <MetricCard
                    title="Avg Trust"
                    value={rels.reduce((a, r) => a + r.trust, 0) / rels.length}
                  />
                  <MetricCard
                    title="Avg Safety"
                    value={rels.reduce((a, r) => a + r.safety, 0) / rels.length}
                  />
                </div>
              </div>
            ) : (
              <div style={{ padding: 10, opacity: 0.8, fontSize: 12 }}>
                No relationships found for this user.
              </div>
            )}
          </Panel>
        </div>
      </main>
    </div>
  );
}
