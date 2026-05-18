import { apiClient } from "@/api/apis";
import { Endpoints } from "@/api/urls";
import { Paths } from "@/routes/path";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import AdminLayout from "../AdminLayout";
import styles from "./AdminPreInfluencerDetail.module.css";

type SurveyAnswers = Record<string, any>;

type PreInfluencerDetail = {
  id: number;
  full_name?: string | null;
  location?: string | null;
  username: string;
  email: string;
  status: string;
  fp_promoter_id?: string | null;
  fp_ref_id?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  survey_step?: number | null;
  survey_token?: string | null;
  terms_agreement?: boolean;
  ig_access_token?: string | null;
  ig_user_id?: string | null;
  survey_answers?: SurveyAnswers;
  audio_count?: number | null;
};

type AudioFile = {
  key?: string;
  download_url: string;
};

type AudioResponse = {
  influencer_id?: string;
  count?: number;
  files?: AudioFile[];
};

type ApproveResponse = {
  ok: boolean;
  influencer_id: string;
  fp_ref_id: string | null;
  fp_promoter_id: string | null;
};

const surveyLabelMap: Record<string, string> = {
  q1_name: "Name",
  q2_email: "Email",
  q3_social_name: "Social Name",
  q4_country: "Country",
  q5_main_language: "Main Language",
  q6_secondary_language: "Secondary Language",
  q7_at_parties: "At Parties",
  q8_after_talking: "After Talking",
  q9_make_friends: "Make Friends",
  q10_focus_more_on: "Focus More On",
  q11_like_to_talk_about: "Talk About",
  q12_first_remember: "First Remember",
  q13_when_someone_cries: "When Someone Cries",
  q14_decisions_with: "Decisions With",
  q15_if_partner_wrong: "If Partner Wrong",
  q16_daily_life_is: "Daily Life Is",
  q17_you_like: "You Like",
  q18_plan_date: "Plan Date",
  q19_you_are_more: "You Are More",
  q20_care_more_about: "Care More About",
  q21_weekend_prefer: "Weekend Prefer",
  q22_rules_are: "Rules Are",
  q23_my_future: "My Future",
  q24_compliments_make_you: "Compliments Make You",
  q25_when_friend_telling: "When Friend Telling",
  q26_secrets: "Secrets",
  q27_love_style: "Love Style",
  q28_when_annoying: "When Annoying",
  q29_catchphrases: "Catchphrases",
  q30_call_loved_ones: "Call Loved Ones",
  q31_topics_to_avoid: "Topics to Avoid",
  q32_talking_style: "Talking Style",
  profile_picture_key: "Profile Picture Key",
  social_selected_platforms: "Selected Platforms",
  social_instagram: "Instagram",
  social_instagram_followers: "Instagram Followers",
  social_instagram_verified: "Instagram Verified",
  social_instagram_verify_error: "Instagram Verify Error",
  social_whatsapp: "WhatsApp",
  social_whatsapp_followers: "WhatsApp Followers",
  social_whatsapp_verified: "WhatsApp Verified",
  social_telegram: "Telegram",
  social_telegram_followers: "Telegram Followers",
  social_telegram_verified: "Telegram Verified",
};

const formatValue = (value: any) => {
  if (value === null || value === undefined || value === "") return "—";
  if (Array.isArray(value)) return value.join(", ");
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
};

const formatDate = (value?: string | null) => {
  if (!value) return "—";
  const date = new Date(value);
  return date.toLocaleString();
};

type LocationState = { preInfluencer?: Partial<PreInfluencerDetail> };

export default function AdminPreInfluencerDetail() {
  const { pre_influencer_id } = useParams();
  const preInfluencerId = pre_influencer_id;
  const navigate = useNavigate();
  const location = useLocation();
  const preload = (location.state as LocationState | null)?.preInfluencer;

  const [detail] = useState<PreInfluencerDetail | null>(
    (preload as PreInfluencerDetail) || null
  );
  const [message, setMessage] = useState<string>("");
  const [pictureUrl, setPictureUrl] = useState<string | null>(null);
  const [approving, setApproving] = useState(false);
  const [audioRefreshKey, setAudioRefreshKey] = useState(0);
  const [audioState, setAudioState] = useState<{
    loading: boolean;
    files: AudioFile[];
    count: number;
    error: string | null;
  }>({ loading: false, files: [], count: 0, error: null });
  const [assetLink, setAssetLink] = useState<string | null>(
    detail?.survey_answers?.asset_link ?? null
  );
  const [assetLinkCopied, setAssetLinkCopied] = useState(false);

  const pictureKey = useMemo(
    () =>
      (detail as any)?.profile_picture_key ||
      detail?.survey_answers?.profile_picture_key ||
      null,
    [detail]
  );

  useEffect(() => {
    if (!preInfluencerId || !pictureKey) {
      setPictureUrl(null);
      return;
    }
    let canceled = false;

    const fetchPictureUrl = async () => {
      try {
        const { data } = await apiClient.get<{ url: string }>(
          Endpoints.pre_influencers.pictureUrl(preInfluencerId)
        );
        if (!canceled) {
          setPictureUrl(data.url);
        }
      } catch (err) {
        console.error("Failed to fetch picture URL", err);
        if (!canceled) {
          setPictureUrl(null);
        }
      }
    };

    void fetchPictureUrl();
    return () => {
      canceled = true;
    };
  }, [preInfluencerId, pictureKey]);

  useEffect(() => {
    if (!preInfluencerId) return;
    let canceled = false;

    const fetchAudio = async () => {
      setAudioState((prev) => ({ ...prev, loading: true, error: null }));
      try {
        const { data } = await apiClient.get<AudioResponse>(
          Endpoints.influencerAudio(preInfluencerId)
        );
        if (canceled) return;
        const files = data?.files ?? [];
        const count = data?.count ?? files.length ?? 0;
        setAudioState({ loading: false, files, count, error: null });
      } catch (err: any) {
        if (canceled) return;
        const detailMsg = err?.response?.data?.detail;
        if (detailMsg === "Influencer has no audio file stored") {
          setAudioState({ loading: false, files: [], count: 0, error: null });
        } else {
          console.error("Failed to fetch audio files", err);
          setAudioState({
            loading: false,
            files: [],
            count: 0,
            error: "Unable to load audio files.",
          });
        }
      }
    };

    void fetchAudio();
    return () => {
      canceled = true;
    };
  }, [preInfluencerId, audioRefreshKey]);

  useEffect(() => {
    if (!preInfluencerId) return;
    let canceled = false;

    const fetchAssetLink = async () => {
      try {
        const { data } = await apiClient.get<{ survey_answers?: Record<string, any> }>(
          Endpoints.pre_influencers.surveyById(preInfluencerId)
        );
        if (canceled) return;
        const link = data?.survey_answers?.asset_link ?? null;
        setAssetLink(link);
      } catch {
        // asset_link is optional — silently ignore
      }
    };

    void fetchAssetLink();
    return () => {
      canceled = true;
    };
  }, [preInfluencerId]);

  const handleCopyAssetLink = useCallback(async () => {
    if (!assetLink) return;
    try {
      await navigator.clipboard.writeText(assetLink);
      setAssetLinkCopied(true);
      setTimeout(() => setAssetLinkCopied(false), 2000);
    } catch {
      // fallback for non-secure contexts
      const el = document.createElement("textarea");
      el.value = assetLink;
      el.style.position = "fixed";
      el.style.opacity = "0";
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      document.body.removeChild(el);
      setAssetLinkCopied(true);
      setTimeout(() => setAssetLinkCopied(false), 2000);
    }
  }, [assetLink]);

  const handleApprove = async () => {
    if (!preInfluencerId) return;
    setApproving(true);
    setMessage("");
    try {
      const { data } = await apiClient.post<ApproveResponse>(
        Endpoints.pre_influencers.approve(preInfluencerId)
      );
      if (data?.ok) {
        setMessage(
          `✅ Approved. Influencer created/linked: ${
            data.influencer_id
          } (fp_ref_id=${data.fp_ref_id || "-"})`
        );
      } else {
        setMessage("Approve returned ok=false");
      }
    } catch (err: any) {
      const backendMsg = err?.response?.data
        ? JSON.stringify(err.response.data)
        : "Approve failed.";
      setMessage(backendMsg);
    } finally {
      setApproving(false);
    }
  };

  const surveyEntries = useMemo(() => {
    if (!detail?.survey_answers) return [];
    return Object.entries(detail.survey_answers)
      .filter(([key]) => key !== "__meta")
      .map(([key, value]) => ({
        key,
        label: surveyLabelMap[key] || key.replace(/_/g, " "),
        value: formatValue(value),
      }));
  }, [detail?.survey_answers]);

  const handleRefresh = () => {
    setAudioRefreshKey((n) => n + 1);
  };

  const statusPill = (
    <span className={styles["status-pill"]}>{detail?.status || "unknown"}</span>
  );

  return (
    <AdminLayout
      title="Pre-Influencer Detail"
      subtitle="Review the full intake data before approving."
      headerRight={
        <button className={styles["secondary"]} onClick={handleRefresh}>
          Refresh
        </button>
      }
    >
      <div className={styles["page"]}>
        {message ? <div className={styles["message"]}>{message}</div> : null}

        {!preInfluencerId ? (
          <div className={styles["state-card"]}>Missing pre-influencer id.</div>
        ) : !detail ? (
          <div className={styles["state-card"]}>
            No pre-influencer data was passed from the list. Go back and open
            again.
          </div>
        ) : (
          <>
            <div className={styles["top-row"]}>
              <button
                onClick={() => navigate(Paths.admin.preInfluencers)}
                className={styles["back"]}
              >
                ← Back to list
              </button>
              <div className={styles["top-actions"]}>
                <div className={styles["status-wrap"]}>{statusPill}</div>
                <button
                  onClick={handleApprove}
                  disabled={approving}
                  className={styles["primary"]}
                >
                  {approving ? "Approving..." : "Approve"}
                </button>
              </div>
            </div>

            <div className={styles["summary-grid"]}>
              <div className={styles["card"]}>
                <div className={styles["card__header"]}>
                  <div>
                    <div className={styles["eyebrow"]}>Identity</div>
                    <h2 className={styles["card__title"]}>
                      {detail.full_name || "(no name)"}{" "}
                      <span className={styles["muted"]}>@{detail.username}</span>
                    </h2>
                  </div>
                </div>
                <div className={styles["meta-grid"]}>
                  <div className={styles["meta"]}>
                    <div className={styles["label"]}>ID</div>
                    <div className={styles["value"]}>{detail.id}</div>
                  </div>
                  <div className={styles["meta"]}>
                    <div className={styles["label"]}>Email</div>
                    <div className={styles["value"]}>{detail.email}</div>
                  </div>
                  <div className={styles["meta"]}>
                    <div className={styles["label"]}>Location</div>
                    <div className={styles["value"]}>
                      {detail.location || "—"}
                    </div>
                  </div>
                  <div className={styles["meta"]}>
                    <div className={styles["label"]}>Survey Step</div>
                    <div className={styles["value"]}>
                      {detail.survey_step ?? "—"}
                    </div>
                  </div>
                  <div className={styles["meta"]}>
                    <div className={styles["label"]}>FP Ref</div>
                    <div className={styles["value"]}>
                      {detail.fp_ref_id || "—"}
                    </div>
                  </div>
                  <div className={styles["meta"]}>
                    <div className={styles["label"]}>FP Promoter</div>
                    <div className={styles["value"]}>
                      {detail.fp_promoter_id || "—"}
                    </div>
                  </div>
                  <div className={styles["meta"]}>
                    <div className={styles["label"]}>Terms Agreement</div>
                    <div className={styles["value"]}>
                      {detail.terms_agreement ? "Yes" : "No"}
                    </div>
                  </div>
                  <div className={styles["meta"]}>
                    <div className={styles["label"]}>Created</div>
                    <div className={styles["value"]}>
                      {formatDate(detail.created_at)}
                    </div>
                  </div>
                  <div className={styles["meta"]}>
                    <div className={styles["label"]}>Updated</div>
                    <div className={styles["value"]}>
                      {formatDate(detail.updated_at)}
                    </div>
                  </div>
                  <div className={styles["meta"]}>
                    <div className={styles["label"]}>Survey Token</div>
                    <div className={styles["value"]}>
                      {detail.survey_token || "—"}
                    </div>
                  </div>
                </div>
              </div>

              <div className={styles["card"]}>
                <div className={styles["card__header"]}>
                  <div>
                    <div className={styles["eyebrow"]}>Profile Picture</div>
                    <h3 className={styles["card__title"]}>Uploaded Image</h3>
                  </div>
                </div>
                {pictureUrl ? (
                  <img
                    src={pictureUrl}
                    alt={`${detail.full_name || detail.username} profile`}
                    className={styles["profile-image"]}
                  />
                ) : (
                  <div className={styles["empty"]}>
                    No picture uploaded for this pre-influencer.
                  </div>
                )}
                <div className={styles["meta"]}>
                  <div className={styles["label"]}>Storage Key</div>
                  <div className={styles["value"]}>{pictureKey || "—"}</div>
                </div>
              </div>
            </div>

            <div className={styles["two-col"]}>
              <div className={styles["card"]}>
                <div className={styles["card__header"]}>
                  <div>
                    <div className={styles["eyebrow"]}>Audio</div>
                    <h3 className={styles["card__title"]}>
                      Voice Samples ({audioState.count})
                    </h3>
                  </div>
                  <button
                    className={styles["secondary"]}
                    onClick={() => setAudioRefreshKey((n) => n + 1)}
                    disabled={audioState.loading}
                  >
                    {audioState.loading ? "Loading..." : "Reload audio"}
                  </button>
                </div>
                {audioState.loading ? (
                  <div className={styles["empty"]}>Loading audio files…</div>
                ) : audioState.error ? (
                  <div className={styles["message"]}>{audioState.error}</div>
                ) : audioState.files.length === 0 ? (
                  <div className={styles["empty"]}>
                    No audio uploaded for this pre-influencer.
                  </div>
                ) : (
                  <div className={styles["audio-list"]}>
                    {audioState.files.map((file, idx) => (
                      <div key={`${file.key}-${idx}`} className={styles["audio"]}>
                        <div className={styles["audio__meta"]}>
                          <span className={styles["label"]}>Key</span>
                          <span className={styles["value"]}>
                            {file.key || "—"}
                          </span>
                        </div>
                        <audio
                          controls
                          src={file.download_url}
                          className={styles["audio__player"]}
                        />
                        <div className={styles["audio__actions"]}>
                          <a
                            href={file.download_url}
                            target="_blank"
                            rel="noreferrer"
                            className={styles["secondary"]}
                          >
                            Open
                          </a>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className={styles["card"]}>
                <div className={styles["card__header"]}>
                  <div>
                    <div className={styles["eyebrow"]}>Accounts</div>
                    <h3 className={styles["card__title"]}>Social & IG</h3>
                  </div>
                </div>
                <div className={styles["meta-grid"]}>
                  <div className={styles["meta"]}>
                    <div className={styles["label"]}>IG User ID</div>
                    <div className={styles["value"]}>
                      {detail.ig_user_id || "—"}
                    </div>
                  </div>
                  <div className={styles["meta"]}>
                    <div className={styles["label"]}>IG Access Token</div>
                    <div className={styles["value"]}>
                      {detail.ig_access_token || "—"}
                    </div>
                  </div>
                  <div className={styles["meta"]}>
                    <div className={styles["label"]}>Audio Count</div>
                    <div className={styles["value"]}>
                      {detail.audio_count ?? audioState.count ?? "—"}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className={styles["card"]}>
              <div className={styles["card__header"]}>
                <div>
                  <div className={styles["eyebrow"]}>03</div>
                  <h3 className={styles["card__title"]}>Assets</h3>
                </div>
                <div className={styles["asset-actions"]}>
                  <button
                    type="button"
                    className={styles["icon-btn"]}
                    onClick={handleCopyAssetLink}
                    disabled={!assetLink}
                    title={assetLinkCopied ? "Copied!" : "Copy link"}
                    aria-label="Copy asset link"
                  >
                    {assetLinkCopied ? (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    ) : (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                      </svg>
                    )}
                  </button>
                  <a
                    href={assetLink ?? undefined}
                    target="_blank"
                    rel="noreferrer"
                    className={`${styles["icon-btn"]} ${!assetLink ? styles["icon-btn--disabled"] : ""}`}
                    title="Open link"
                    aria-label="Open asset link in new tab"
                    onClick={(e) => { if (!assetLink) e.preventDefault(); }}
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                      <polyline points="15 3 21 3 21 9" />
                      <line x1="10" y1="14" x2="21" y2="3" />
                    </svg>
                  </a>
                </div>
              </div>
              {assetLink ? (
                <div className={styles["asset-link"]}>{assetLink}</div>
              ) : (
                <div className={styles["empty"]}>No asset link submitted yet.</div>
              )}
            </div>

            <div className={styles["card"]}>
              <div className={styles["card__header"]}>
                <div>
                  <div className={styles["eyebrow"]}>Survey</div>
                  <h3 className={styles["card__title"]}>Responses</h3>
                </div>
              </div>

              {surveyEntries.length === 0 ? (
                <div className={styles["empty"]}>No survey answers saved yet.</div>
              ) : (
                <div className={styles["survey-grid"]}>
                  {surveyEntries.map((entry) => (
                    <div key={entry.key} className={styles["meta"]}>
                      <div className={styles["label"]}>{entry.label}</div>
                      <div className={styles["value"]}>{entry.value}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </AdminLayout>
  );
}
