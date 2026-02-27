import { apiClient } from "@/api/apis";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Paths } from "@/routes/path";
import AdminLayout from "../AdminLayout";
import AdminTwoColumn from "../AdminTwoColumn";
import styles from "./AdminPreInfluencers.module.css";

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
  const [isMobile, setIsMobile] = useState(
    typeof window !== "undefined" &&
    window.matchMedia("(max-width: 900px)").matches
  );
  const navigate = useNavigate();

  const load = async () => {
    setLoading(true);
    setMsg("");
    try {
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

  useEffect(() => {
    const query = window.matchMedia("(max-width: 900px)");
    const handler = (event: MediaQueryListEvent) => setIsMobile(event.matches);
    if (query.addEventListener) {
      query.addEventListener("change", handler);
    } else {
      query.addListener(handler);
    }
    return () => {
      if (query.removeEventListener) {
        query.removeEventListener("change", handler);
      } else {
        query.removeListener(handler);
      }
    };
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
          `✅ Approved. Influencer created/linked: ${data.influencer_id
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
  const columns =
    "80px 220px 200px minmax(200px, 1fr) 130px minmax(240px, 1fr) 220px";

  return (
    <AdminLayout
      title="Pre-Influencers"
      subtitle="Review pending signups and approve to create or link influencers (id = username with FP fields copied)."
      headerRight={
        <button
          onClick={load}
          disabled={loading}
          className={styles["refresh"]}
        >
          {loading ? "Loading..." : "Refresh"}
        </button>
      }
    >
      <AdminTwoColumn sidebar={<aside className={styles["sidebar"]}>
        <div className={styles["sidebar-section"]}>
          <div className={styles["sidebar-title"]}>Queue</div>
          <div className={styles["sidebar-value"]}>{rows.length} pending</div>
        </div>
        <div className={styles["sidebar-section"]}>
          <div className={styles["sidebar-title"]}>Status</div>
          <div className={styles["sidebar-value"]}>
            {loading ? "Loading…" : actingId !== null ? "Approving…" : "Ready"}
          </div>
        </div>
        {msg ? <pre className={styles["message"]}>{msg}</pre> : null}
      </aside>}>
        <section className={styles["main"]}>
          <div className={styles["page"]}>

        {loading ? (
          <div className={styles["state-card"]}>Loading...</div>
        ) : rows.length === 0 ? (
          <div className={styles["state-card"]}>
            No pending pre-influencers.
          </div>
        ) : isMobile ? (
          <div className={styles["card-grid"]}>
            {rows.map((p) => (
              <div key={p.id} className={styles["card"]}>
                <div className={styles["card__header"]}>
                  <div className={styles["card__identity"]}>
                    <div className={`${styles["truncate"]} ${styles["name"]}`}>
                      {p.full_name || p.username}
                    </div>
                    <div className={`${styles["truncate"]} ${styles["email"]}`}>
                      {p.email}
                    </div>
                  </div>
                  <div className={styles["card__actions"]}>
                    <button
                      onClick={() =>
                        navigate(Paths.admin.preInfluencerDetail(`${p.id}`), {
                          state: { preInfluencer: p },
                        })
                      }
                      className={styles["view"]}
                    >
                      View
                    </button>
                    <button
                      onClick={() => approve(p.id)}
                      disabled={actingId !== null}
                      className={styles["approve"]}
                    >
                      {actingId === p.id ? "Approving..." : "Approve"}
                    </button>
                  </div>
                </div>

                <div className={styles["meta-grid"]}>
                  <div className={styles["meta"]}>
                    <div className={styles["label"]}>ID</div>
                    <div className={styles["value"]}>{p.id}</div>
                  </div>
                  <div className={styles["meta"]}>
                    <div className={styles["label"]}>Status</div>
                    <div className={styles["value"]}>{p.status}</div>
                  </div>
                  <div className={styles["meta"]}>
                    <div className={styles["label"]}>Username</div>
                    <div className={styles["value"]}>{p.username}</div>
                  </div>
                  <div className={styles["meta"]}>
                    <div className={styles["label"]}>FP Ref</div>
                    <div className={styles["value"]}>{p.fp_ref_id || "-"}</div>
                  </div>
                  <div className={`${styles["meta"]} ${styles["full-row"]}`}>
                    <div className={styles["label"]}>FP Promoter ID</div>
                    <div className={styles["value"]}>
                      {p.fp_promoter_id || "-"}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className={styles["table"]}>
            <div className={styles["table__inner"]}>
              <div
                className={`${styles["row"]} ${styles["row--header"]}`}
                style={{ gridTemplateColumns: columns }}
              >
                <div>ID</div>
                <div>Name</div>
                <div>Username</div>
                <div>Email</div>
                <div>Status</div>
                <div>FP</div>
                <div>Actions</div>
              </div>

              {rows.map((p) => (
                <div
                  key={p.id}
                  className={styles["row"]}
                  style={{ gridTemplateColumns: columns }}
                >
                  <div className={`${styles["cell"]} ${styles["muted"]}`}>
                    {p.id}
                  </div>
                  <div className={`${styles["cell"]} ${styles["strong"]}`}>
                    {p.full_name || "(no name)"}
                  </div>
                  <div className={styles["cell"]}>{p.username}</div>
                  <div className={styles["cell"]}>{p.email}</div>
                  <div className={styles["cell"]}>
                    <span className={styles["status-pill"]}>{p.status}</span>
                  </div>
                  <div
                    className={`${styles["cell"]} ${styles["fp-block"]} ${styles["muted"]}`}
                  >
                    <div className={styles["truncate"]}>
                      fp_ref_id: {p.fp_ref_id || "-"}
                    </div>
                    <div className={styles["truncate"]}>
                      fp_promoter_id: {p.fp_promoter_id || "-"}
                    </div>
                  </div>
                  <div className={styles["actions"]}>
                    <button
                      onClick={() =>
                        navigate(Paths.admin.preInfluencerDetail(`${p.id}`), {
                          state: { preInfluencer: p },
                        })
                      }
                      className={styles["view"]}
                    >
                      View
                    </button>
                    <button
                      onClick={() => approve(p.id)}
                      disabled={actingId !== null}
                      className={styles["approve"]}
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
        </section>
      </AdminTwoColumn>
    </AdminLayout>
  );
}
