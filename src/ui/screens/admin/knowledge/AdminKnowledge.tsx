import React, { useCallback, useEffect, useState } from "react";
import { apiClient } from "@/api/apis";
import { InfluencerDataModel } from "@/data/models/InfluencerDataModel";
import { AdminInfluencerRepo } from "@/data/repositories/AdminInfluencerRepo";
import { AdminServices, KnowledgeGetResponse } from "@/api/services/AdminServices";
import AdminLayout from "@/ui/screens/admin/AdminLayout";
import AdminTwoColumn from "@/ui/screens/admin/AdminTwoColumn";
import styles from "./AdminKnowledge.module.css";

const admin = AdminServices(apiClient);
const adminInfluencerRepo = AdminInfluencerRepo();

const AdminKnowledge: React.FC = () => {
  const [influencers, setInfluencers] = useState<InfluencerDataModel[]>([]);
  const [loadingList, setLoadingList] = useState(false);
  const [listError, setListError] = useState<string | null>(null);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loadingKb, setLoadingKb] = useState(false);
  const [kbData, setKbData] = useState<KnowledgeGetResponse | null>(null);
  const [hasKb, setHasKb] = useState(false);
  const [text, setText] = useState("");

  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Load influencer list on mount
  useEffect(() => {
    let alive = true;
    setLoadingList(true);
    setListError(null);
    adminInfluencerRepo
      .getInfluencers()
      .then((data) => {
        if (!alive) return;
        setInfluencers(data || []);
        if (data && data.length > 0) {
          setSelectedId(data[0].id);
        }
      })
      .catch((e) => {
        if (!alive) return;
        setListError(e instanceof Error ? e.message : "Failed to load influencers");
      })
      .finally(() => {
        if (!alive) return;
        setLoadingList(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  // Load KB when selected influencer changes
  const loadKb = useCallback(async (influencerId: string) => {
    setLoadingKb(true);
    setKbData(null);
    setHasKb(false);
    setText("");
    setError(null);
    setSuccessMsg(null);
    setConfirmDelete(false);
    try {
      const data = await admin.getKnowledge(influencerId);
      setKbData(data);
      setText(data.text);
      setHasKb(true);
    } catch (e: any) {
      const status = e?.response?.status;
      if (status === 404) {
        setHasKb(false);
      } else if (status === 403) {
        setError("Admin access only.");
      } else {
        setError(e instanceof Error ? e.message : "Failed to load knowledge.");
      }
    } finally {
      setLoadingKb(false);
    }
  }, []);

  useEffect(() => {
    if (selectedId) {
      loadKb(selectedId);
    }
  }, [selectedId, loadKb]);

  const handleSave = async () => {
    if (!selectedId) return;
    if (!text.trim()) {
      setError("Knowledge text is required.");
      return;
    }
    setSaving(true);
    setError(null);
    setSuccessMsg(null);
    try {
      const result = await admin.upsertKnowledge(selectedId, text);
      setKbData({ ...result, text, text_hash: undefined });
      setHasKb(true);
      setSuccessMsg(`Saved — ${result.chunk_count} chunk${result.chunk_count !== 1 ? "s" : ""} indexed.`);
    } catch (e: any) {
      const status = e?.response?.status;
      if (status === 400) {
        setError("Knowledge text is required.");
      } else if (status === 403) {
        setError("Admin access only.");
      } else {
        setError("Server error — your changes are preserved. Retry.");
      }
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedId) return;
    setDeleting(true);
    setError(null);
    setSuccessMsg(null);
    try {
      await admin.deleteKnowledge(selectedId);
      setKbData(null);
      setHasKb(false);
      setText("");
      setConfirmDelete(false);
      setSuccessMsg("Knowledge deleted.");
    } catch (e: any) {
      const status = e?.response?.status;
      if (status === 404) {
        setError("No knowledge found to delete.");
      } else {
        setError(e instanceof Error ? e.message : "Delete failed.");
      }
      setConfirmDelete(false);
    } finally {
      setDeleting(false);
    }
  };

  const selectedInfluencer = influencers.find((inf) => inf.id === selectedId);
  const isBusy = saving || deleting;

  const formatDate = (iso?: string | null) => {
    if (!iso) return null;
    try {
      return new Date(iso).toLocaleString();
    } catch {
      return iso;
    }
  };

  return (
    <AdminLayout title="Knowledge Base" subtitle="Manage influencer knowledge text and indexing.">
      <AdminTwoColumn sidebar={<aside className={styles["sidebar"]}>
          <div className={styles["sidebar-header"]}>Influencers</div>
          <div className={styles["sidebar-list"]}>
            {loadingList && <div className={styles["sidebar-empty"]}>Loading…</div>}
            {listError && <div className={styles["sidebar-empty"]}>{listError}</div>}
            {!loadingList && influencers.length === 0 && !listError && (
              <div className={styles["sidebar-empty"]}>No influencers found.</div>
            )}
            {influencers.map((inf) => (
              <button
                key={inf.id}
                className={`${styles["sidebar-item"]} ${selectedId === inf.id ? styles["sidebar-item--active"] : ""}`}
                onClick={() => setSelectedId(inf.id)}
              >
                {inf.name || inf.id}
              </button>
            ))}
          </div>
        </aside>}>
        <section className={styles["main"]}>
          {!selectedId && (
            <div className={styles["panel-placeholder"]}>Select an influencer from the list.</div>
          )}

          {selectedId && (
            <>
              {/* Header */}
              <div className={styles["panel-header"]}>
                <div>
                  <div className={styles["panel-title"]}>
                    {selectedInfluencer?.name || selectedId}
                  </div>
                  {hasKb && kbData && (
                    <div className={styles["meta"]}>
                      <span>{kbData.chunk_count} chunk{kbData.chunk_count !== 1 ? "s" : ""}</span>
                      {kbData.updated_at && <span>Updated {formatDate(kbData.updated_at)}</span>}
                    </div>
                  )}
                </div>
              </div>

              {/* Loading KB */}
              {loadingKb && <div className={styles["loading"]}>Loading knowledge…</div>}

              {/* Editor */}
              {!loadingKb && (
                <>
                  {!hasKb && (
                    <div className={styles["empty-state"]}>No knowledge yet — enter text below and save.</div>
                  )}

                  <textarea
                    className={styles["textarea"]}
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    placeholder="Enter long-form knowledge text for this influencer…"
                    disabled={isBusy}
                  />

                  {/* Feedback messages */}
                  {successMsg && (
                    <div className={`${styles["message"]} ${styles["message--success"]}`}>
                      {successMsg}
                    </div>
                  )}
                  {error && (
                    <div className={`${styles["message"]} ${styles["message--error"]}`}>
                      {error}
                    </div>
                  )}

                  {/* Action buttons */}
                  <div className={styles["button-row"]}>
                    <button
                      className={styles["primary"]}
                      onClick={handleSave}
                      disabled={isBusy || !text.trim()}
                    >
                      {saving ? "Saving…" : "Save"}
                    </button>

                    {hasKb && !confirmDelete && (
                      <button
                        className={styles["danger"]}
                        onClick={() => setConfirmDelete(true)}
                        disabled={isBusy}
                      >
                        Delete
                      </button>
                    )}

                    {confirmDelete && (
                      <div className={styles["confirm-row"]}>
                        <span className={styles["confirm-label"]}>Delete all knowledge for this influencer?</span>
                        <button
                          className={styles["danger"]}
                          onClick={handleDelete}
                          disabled={deleting}
                        >
                          {deleting ? "Deleting…" : "Confirm delete"}
                        </button>
                        <button
                          className={styles["ghost"]}
                          onClick={() => setConfirmDelete(false)}
                          disabled={deleting}
                        >
                          Cancel
                        </button>
                      </div>
                    )}
                  </div>
                </>
              )}
            </>
          )}
        </section>
      </AdminTwoColumn>
    </AdminLayout>
  );
};

export default AdminKnowledge;
