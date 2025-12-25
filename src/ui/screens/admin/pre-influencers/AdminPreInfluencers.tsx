import { apiClient } from "@/api/apis";
import { useEffect, useMemo, useState } from "react";

type PreInfluencer = {
  id: number;
  full_name?: string | null;
  location?: string | null;
  username: string;
  email: string;
  status: string;
  fp_promoter_id?: string | null;
  fp_ref_id?: string | null;
  created_at?: string | null;
};

type ApproveResponse = {
  ok: boolean;
  influencer_id: string;
  fp_ref_id: string | null;
  fp_promoter_id: string | null;
};

export default function AdminPreInfluencers() {
  const [items, setItems] = useState<PreInfluencer[]>([]);
  const [loading, setLoading] = useState(true);
  const [actingId, setActingId] = useState<number | null>(null);
  const [msg, setMsg] = useState<string>("");

  const load = async () => {
    setLoading(true);
    setMsg("");
    try {
      // Adjust if your admin endpoint is different
      const { data } = await apiClient.get<PreInfluencer[]>(
        "/pre-influencers",
        { params: { status: "pending" } }
      );
      setItems(data);
    } catch (e: any) {
      setMsg(
        e?.response?.data ? JSON.stringify(e.response.data) : "Failed to load."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const approve = async (preId: number) => {
    setActingId(preId);
    setMsg("");
    try {
      const { data } = await apiClient.post<ApproveResponse>(
        `/pre-influencers/${preId}/approve`
      );

      if (data?.ok) {
        setItems((prev) => prev.filter((x) => x.id !== preId));
        setMsg(
          `✅ Approved. Influencer created/linked: ${
            data.influencer_id
          } (fp_ref_id=${data.fp_ref_id || "-"})`
        );
      } else {
        setMsg("Approve returned ok=false");
      }
    } catch (e: any) {
      setMsg(
        e?.response?.data ? JSON.stringify(e.response.data) : "Approve failed."
      );
    } finally {
      setActingId(null);
    }
  };

  const rows = useMemo(() => items, [items]);
  const cell = {
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  };

  // add near top (below cell helper)
  const isMobile = window.matchMedia("(max-width: 900px)").matches;

  const cardStyle: React.CSSProperties = {
    border: "1px solid rgba(255,255,255,0.12)",
    borderRadius: 14,
    padding: 14,
    background: "rgba(255,255,255,0.04)",
  };

  const labelStyle: React.CSSProperties = { opacity: 0.7, fontSize: 12 };
  const valueStyle: React.CSSProperties = { fontWeight: 700 };

  return (
    <div
      style={{ padding: 24, color: "white", maxWidth: 1100, margin: "0 auto" }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <div>
          <h2 style={{ margin: 0 }}>Admin — PreInfluencers</h2>
          <p style={{ opacity: 0.8, marginTop: 8, marginBottom: 0 }}>
            Approve a pre-influencer → creates/links an Influencer with{" "}
            <b>id = username</b> and copies FP fields.
          </p>
        </div>

        <button
          onClick={load}
          disabled={loading}
          style={{ padding: "8px 12px", borderRadius: 10 }}
        >
          {loading ? "Loading..." : "Refresh"}
        </button>
      </div>

      {msg && (
        <pre
          style={{
            whiteSpace: "pre-wrap",
            padding: 12,
            borderRadius: 12,
            background: "rgba(255,255,255,0.06)",
            border: "1px solid rgba(255,255,255,0.12)",
            marginTop: 12,
          }}
        >
          {msg}
        </pre>
      )}

      <div style={{ marginTop: 16 }}>
        {loading ? (
          <div style={{ padding: 16, opacity: 0.8 }}>Loading...</div>
        ) : rows.length === 0 ? (
          <div style={{ padding: 16, opacity: 0.8 }}>
            No pending pre-influencers.
          </div>
        ) : isMobile ? (
          // ✅ MOBILE: cards
          <div style={{ display: "grid", gap: 12 }}>
            {rows.map((p) => (
              <div key={p.id} style={cardStyle}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: 12,
                    alignItems: "flex-start",
                  }}
                >
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 16, fontWeight: 800, ...cell }}>
                      {p.full_name || p.username}
                    </div>
                    <div
                      style={{
                        opacity: 0.8,
                        fontSize: 12,
                        marginTop: 4,
                        ...cell,
                      }}
                    >
                      {p.email}
                    </div>
                  </div>

                  <button
                    onClick={() => approve(p.id)}
                    disabled={actingId !== null}
                    style={{
                      padding: "8px 12px",
                      borderRadius: 10,
                      background: "#3b82f6",
                      color: "white",
                      border: "none",
                      fontWeight: 700,
                      cursor: actingId !== null ? "not-allowed" : "pointer",
                      flexShrink: 0,
                    }}
                  >
                    {actingId === p.id ? "Approving..." : "Approve"}
                  </button>
                </div>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: 10,
                    marginTop: 12,
                  }}
                >
                  <div style={{ minWidth: 0 }}>
                    <div style={labelStyle}>ID</div>
                    <div style={{ ...valueStyle, ...cell }}>{p.id}</div>
                  </div>

                  <div style={{ minWidth: 0 }}>
                    <div style={labelStyle}>Status</div>
                    <div style={{ ...valueStyle, ...cell }}>{p.status}</div>
                  </div>

                  <div style={{ minWidth: 0 }}>
                    <div style={labelStyle}>Username</div>
                    <div style={{ ...valueStyle, ...cell }}>{p.username}</div>
                  </div>

                  <div style={{ minWidth: 0 }}>
                    <div style={labelStyle}>FP Ref</div>
                    <div style={{ ...valueStyle, ...cell }}>
                      {p.fp_ref_id || "-"}
                    </div>
                  </div>

                  <div style={{ minWidth: 0, gridColumn: "1 / -1" }}>
                    <div style={labelStyle}>FP Promoter ID</div>
                    <div style={{ ...valueStyle, ...cell }}>
                      {p.fp_promoter_id || "-"}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          // ✅ DESKTOP: table with horizontal scroll
          <div
            style={{
              borderRadius: 14,
              border: "1px solid rgba(255,255,255,0.12)",
              overflowX: "auto",
              overflowY: "hidden",
            }}
          >
            <div style={{ minWidth: 1180 }}>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns:
                    "80px 220px 200px 260px 120px 240px 140px",
                  padding: "12px 12px",
                  background: "rgba(255,255,255,0.06)",
                  fontWeight: 700,
                  fontSize: 13,
                }}
              >
                <div>ID</div>
                <div>Name</div>
                <div>Username</div>
                <div>Email</div>
                <div>Status</div>
                <div>FP</div>
                <div />
              </div>

              {rows.map((p) => (
                <div
                  key={p.id}
                  style={{
                    display: "grid",
                    gridTemplateColumns:
                      "80px 220px 200px 260px 120px 240px 140px",
                    padding: "12px 12px",
                    borderTop: "1px solid rgba(255,255,255,0.08)",
                    alignItems: "center",
                    fontSize: 13,
                  }}
                >
                  <div style={{ ...cell, opacity: 0.9 }}>{p.id}</div>
                  <div style={{ ...cell, fontWeight: 800 }}>
                    {p.full_name || "(no name)"}
                  </div>
                  <div style={{ ...cell, opacity: 0.9 }}>{p.username}</div>
                  <div style={{ ...cell, opacity: 0.9 }}>{p.email}</div>
                  <div style={{ ...cell, opacity: 0.9 }}>{p.status}</div>

                  <div style={{ opacity: 0.9, fontSize: 12, minWidth: 0 }}>
                    <div style={cell}>fp_ref_id: {p.fp_ref_id || "-"}</div>
                    <div style={cell}>
                      fp_promoter_id: {p.fp_promoter_id || "-"}
                    </div>
                  </div>

                  <div style={{ display: "flex", justifyContent: "flex-end" }}>
                    <button
                      onClick={() => approve(p.id)}
                      disabled={actingId !== null}
                      style={{
                        padding: "8px 12px",
                        borderRadius: 10,
                        background: "#3b82f6",
                        color: "white",
                        border: "none",
                        fontWeight: 700,
                        cursor: actingId !== null ? "not-allowed" : "pointer",
                      }}
                    >
                      {actingId === p.id ? "Approving..." : "Approve"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
