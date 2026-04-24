import defaultAvatar from "@/assets/image/avatar.png";
import mbtiData from "@/data/mbti.json";
import { InfluencerDataModel } from "@/data/models/InfluencerDataModel";
import { AdminInfluencerRepo } from "@/data/repositories/AdminInfluencerRepo";
import { InfluencerRepo } from "@/data/repositories/InfluencerRepo";
import { splitName } from "@/utils/StringUtils";
import SvgPack from "@/utils/SvgPack";
import React, {
  ChangeEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { apiClient } from "@/api/apis";
import { AdminServices, KnowledgeGetResponse } from "@/api/services/AdminServices";
import AdminLayout from "../AdminLayout";
import AdminTwoColumn from "../AdminTwoColumn";
import styles from "./CreateInfluencer.module.css";

const adminSvc = AdminServices(apiClient);

type InfluencerFormState = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  avatarUrl: string;
  created_at: string;
  notes: string;
  voice_id: string;
  prompt_template: string;
  influencer_agent_id_third_part: string;
  bio_json: PersonaProfile;
  fp_ref_id?: string | null;
};

type MbtiPersonality = {
  code: string;
  name: string;
  rules: string[];
};

type PersonaStages = {
  hate: string;
  dislike: string;
  strangers: string;
  friends: string;
  flirting: string;
  dating: string;
  girlfriend: string;
};

const STAGE_KEYS: Array<keyof PersonaStages> = [
  "hate",
  "dislike",
  "strangers",
  "friends",
  "flirting",
  "dating",
  "girlfriend",
];
type PersonaProfile = {
  likes: string[];
  dislikes: string[];
  mbti_architype: string;
  mbti_rules: string;
  personality_rules: string;
  tone: string;
  stages: PersonaStages;
  stages_focus?: keyof PersonaStages | "";
};

function toDateInputValue(value: string | undefined | null) {
  if (!value) {
    return new Date().toISOString().slice(0, 10);
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value;
  }
  const pattern = value.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
  if (pattern) {
    const [, day, month, year] = pattern;
    const normalizedYear =
      year.length === 2 ? `20${year}` : year.padStart(4, "0");
    const normalizedMonth = month.padStart(2, "0");
    const normalizedDay = day.padStart(2, "0");
    return `${normalizedYear}-${normalizedMonth}-${normalizedDay}`;
  }
  const parsed = new Date(value);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toISOString().slice(0, 10);
  }
  return new Date().toISOString().slice(0, 10);
}

const resolveAvatarSrc = (value?: string | null) => {
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed.length > 0) {
      return trimmed;
    }
  }
  return defaultAvatar;
};

const STAGE_PLACEHOLDERS: Record<keyof PersonaStages, string> = {
  hate: "Avoids interaction and stays quiet.",
  dislike: "Remains silent and distant.",
  strangers: "Observes quietly, initially reserved.",
  friends: "Engages in friendly conversation and shows interest.",
  flirting: "Shows interest through subtle actions.",
  dating: "Plans meticulously and shows affection through acts of service.",
  girlfriend:
    "Demonstrates deep care and commitment, prioritizes long-term connection.",
};

const createDefaultPersonaProfile = (): PersonaProfile => ({
  likes: [],
  dislikes: [],
  mbti_architype: "",
  mbti_rules: "",
  personality_rules: "",
  tone: "",
  stages: {
    hate: "",
    dislike: "",
    strangers: "",
    friends: "",
    flirting: "",
    dating: "",
    girlfriend: "",
  },
  stages_focus: "",
});

const toStringArray = (value: unknown): string[] => {
  if (Array.isArray(value)) {
    return value
      .map((item) => (typeof item === "string" ? item.trim() : ""))
      .filter(Boolean);
  }
  if (typeof value === "string") {
    return value
      .split("\n")
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return [];
};

const extractPersonaProfile = (raw: unknown): PersonaProfile => {
  const base = createDefaultPersonaProfile();
  let payload: Record<string, any> = {};

  if (typeof raw === "string") {
    try {
      payload = JSON.parse(raw) as Record<string, any>;
    } catch {
      payload = {};
    }
  } else if (raw && typeof raw === "object") {
    payload = raw as Record<string, any>;
  }

  const likes = toStringArray(payload.likes);
  const dislikes = toStringArray(payload.dislikes);

  const stages: PersonaStages = { ...base.stages };
  STAGE_KEYS.forEach((key) => {
    if (typeof payload?.stages?.[key] === "string") {
      stages[key] = String(payload.stages[key]);
    }
  });

  return {
    ...base,
    likes,
    dislikes,
    mbti_architype:
      typeof payload.mbti_architype === "string"
        ? payload.mbti_architype
        : base.mbti_architype,
    mbti_rules:
      typeof payload.mbti_rules === "string"
        ? payload.mbti_rules
        : base.mbti_rules,
    personality_rules:
      typeof payload.personality_rules === "string"
        ? payload.personality_rules
        : base.personality_rules,
    tone: typeof payload.tone === "string" ? payload.tone : base.tone,
    stages,
    stages_focus:
      payload.stages_focus && STAGE_KEYS.includes(payload.stages_focus)
        ? payload.stages_focus
        : base.stages_focus,
  };
};

const personaProfileToJson = (
  profile: PersonaProfile
): Record<string, unknown> => {
  const safeStages = STAGE_KEYS.reduce<Record<string, string>>((acc, key) => {
    acc[key] = profile.stages[key] ?? "";
    return acc;
  }, {});

  return {
    likes: profile.likes ?? [],
    dislikes: profile.dislikes ?? [],
    mbti_architype: profile.mbti_architype ?? "",
    mbti_rules: profile.mbti_rules ?? "",
    personality_rules: profile.personality_rules ?? "",
    tone: profile.tone ?? "",
    stages: safeStages,
    stages_focus: profile.stages_focus ?? "",
  };
};

const createDefaultFormState = (): InfluencerFormState => ({
  id: "",
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  avatarUrl: "",
  created_at: toDateInputValue(null),
  notes: "",
  voice_id: "",
  prompt_template: "",
  influencer_agent_id_third_part: "",
  bio_json: createDefaultPersonaProfile(),
});

function createFormStateFromInfluencer(
  influencer: InfluencerDataModel
): InfluencerFormState {
  const { firstName, lastName } = splitName(influencer.name);
  const normalizedAvatar = (influencer.img ?? "").trim();
  const avatarUrl =
    normalizedAvatar && normalizedAvatar !== defaultAvatar
      ? normalizedAvatar
      : "";
  return {
    id: String(influencer.id),
    firstName,
    lastName,
    email: "",
    phone: "",
    avatarUrl,
    created_at: toDateInputValue(influencer.created_at),
    notes: "",
    voice_id: influencer.voice_id ?? "",
    prompt_template: influencer.prompt_template ?? "",
    influencer_agent_id_third_part:
      influencer.influencer_agent_id_third_part ?? "",
    bio_json: extractPersonaProfile(influencer.bio_json ?? ""),
  };
}

const CreateInfluencer: React.FC = () => {
  const mbtiPersonalities: MbtiPersonality[] = Array.isArray(
    (mbtiData as any)?.personalities
  )
    ? (mbtiData as any).personalities
    : [];

  const [influencers, setInfluencers] = useState<InfluencerDataModel[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [formState, setFormState] = useState<InfluencerFormState>(() =>
    createDefaultFormState()
  );
  const [searchTerm, setSearchTerm] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(
    () => new Set(["basic-info", "relationship-stages", "knowledge"])
  );
  const toggleSection = (id: string) =>
    setCollapsedSections((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  const [personaListDrafts, setPersonaListDrafts] = useState<{
    likes: string;
    dislikes: string;
  }>({
    likes: "",
    dislikes: "",
  });
  const influencerRepo = useMemo(() => InfluencerRepo(), []);
  const adminInfluencerRepo = useMemo(() => AdminInfluencerRepo(), []);

  // ── Knowledge base state ──────────────────────────────────────
  const [kbText, setKbText]       = useState("");
  const [kbData, setKbData]       = useState<KnowledgeGetResponse | null>(null);
  const [hasKb, setHasKb]         = useState(false);
  const [loadingKb, setLoadingKb] = useState(false);
  const [savingKb, setSavingKb]   = useState(false);
  const [kbError, setKbError]     = useState<string | null>(null);
  const [kbSuccess, setKbSuccess] = useState<string | null>(null);

  // ── Per-section save state ─────────────────────────────────────
  const [sectionSaving, setSectionSaving] = useState<Record<string, boolean>>({});
  const [sectionMsg, setSectionMsg] = useState<Record<string, { type: "success" | "error"; msg: string } | null>>({});

  const loadKb = useCallback(async (influencerId: string) => {
    setLoadingKb(true);
    setKbData(null); setHasKb(false); setKbText("");
    setKbError(null); setKbSuccess(null);
    try {
      const data = await adminSvc.getKnowledge(influencerId);
      setKbData(data); setKbText(data.text); setHasKb(true);
    } catch (e: any) {
      if (e?.response?.status !== 404) {
        setKbError(e instanceof Error ? e.message : "Failed to load knowledge.");
      }
    } finally { setLoadingKb(false); }
  }, []);

  useEffect(() => {
    if (selectedId) loadKb(selectedId);
    else { setKbText(""); setKbData(null); setHasKb(false); }
  }, [selectedId, loadKb]);

  const handleKbSave = async () => {
    if (!selectedId || !kbText.trim()) {
      setKbError("Knowledge text is required."); return;
    }
    setSavingKb(true); setKbError(null); setKbSuccess(null);
    try {
      const result = await adminSvc.upsertKnowledge(selectedId, kbText);
      setKbData({ ...result, text: kbText });
      setHasKb(true);
      setKbSuccess(`Saved — ${result.chunk_count} chunk${result.chunk_count !== 1 ? "s" : ""} indexed.`);
    } catch (e: any) {
      setKbError(e?.response?.status === 400 ? "Knowledge text is required." : "Save failed. Retry.");
    } finally { setSavingKb(false); }
  };

  const patchSection = async (sectionId: string) => {
    const existing = influencers.find((inf) => inf.id === selectedId);
    if (!selectedId || !existing) return;
    const nameFromFields = `${formState.firstName} ${formState.lastName}`.trim();
    const fullName = nameFromFields || existing.name;
    const base: InfluencerDataModel = {
      id: existing.id,
      name: fullName,
      username: existing.username,
      img: resolveAvatarSrc(formState.avatarUrl),
      created_at: formState.created_at || existing.created_at,
      earnings: existing.earnings ?? 0,
      isSelected: false,
      voice_id: formState.voice_id || existing.voice_id || "",
      prompt_template: formState.prompt_template || existing.prompt_template || "",
      influencer_agent_id_third_part: formState.influencer_agent_id_third_part || existing.influencer_agent_id_third_part || "",
      bio_json: personaProfileToJson(formState.bio_json),
    };
    setSectionSaving((prev) => ({ ...prev, [sectionId]: true }));
    setSectionMsg((prev) => ({ ...prev, [sectionId]: null }));
    try {
      const serverInfluencer = await influencerRepo.patchInfluencer(
        base,
        base.prompt_template,
        base.influencer_agent_id_third_part,
        base.bio_json,
        base.voice_id,
      );
      const merged = {
        ...base,
        ...serverInfluencer,
      };
      setInfluencers((prev) => prev.map((inf) => inf.id === merged.id ? merged : inf));
      setSectionMsg((prev) => ({ ...prev, [sectionId]: { type: "success", msg: "Saved" } }));
      setTimeout(() => setSectionMsg((prev) => ({ ...prev, [sectionId]: null })), 3000);
    } catch {
      setSectionMsg((prev) => ({ ...prev, [sectionId]: { type: "error", msg: "Save failed. Retry." } }));
    } finally {
      setSectionSaving((prev) => ({ ...prev, [sectionId]: false }));
    }
  };

  useEffect(() => {
    let isMounted = true;
    (async () => {
      setIsLoading(true);
      try {
        const data = await adminInfluencerRepo.getInfluencers();
        if (!isMounted) return;
        setInfluencers(data);
        setSelectedId(data.length ? data[0].id : null);
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    })();

    return () => {
      isMounted = false;
    };
  }, [adminInfluencerRepo]);

  useEffect(() => {
    if (selectedId === null) {
      setFormState(createDefaultFormState());
      return;
    }

    const selected = influencers.find(
      (influencer) => influencer.id === selectedId
    );
    if (selected) {
      setFormState(createFormStateFromInfluencer(selected));
    }
  }, [selectedId, influencers]);

  const filteredInfluencers = useMemo(() => {
    if (!searchTerm.trim()) {
      return influencers;
    }
    const normalized = searchTerm.trim().toLowerCase();
    return influencers.filter((influencer) => {
      return (
        influencer.name.toLowerCase().includes(normalized) ||
        influencer.username.toLowerCase().includes(normalized) ||
        String(influencer.id).toLowerCase().includes(normalized)
      );
    });
  }, [influencers, searchTerm]);

  const handleFieldChange =
    (field: keyof InfluencerFormState) =>
      (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { value } = event.target;
        setFormState((prev) => ({ ...prev, [field]: value }));
      };

  const handlePersonaListKeyDown =
    (field: "likes" | "dislikes") =>
      (event: React.KeyboardEvent<HTMLInputElement>) => {
        if (event.key !== "Enter") return;
        event.preventDefault();
        const value = personaListDrafts[field].trim();
        if (!value) return;
        setFormState((prev) => ({
          ...prev,
          bio_json: {
            ...prev.bio_json,
            [field]: [...prev.bio_json[field], value],
          },
        }));
        setPersonaListDrafts((prev) => ({ ...prev, [field]: "" }));
      };

  const handlePersonaListDraftChange =
    (field: "likes" | "dislikes") => (event: ChangeEvent<HTMLInputElement>) => {
      setPersonaListDrafts((prev) => ({
        ...prev,
        [field]: event.target.value,
      }));
    };

  const handleRemovePersonaItem = (
    field: "likes" | "dislikes",
    value: string
  ) => {
    setFormState((prev) => ({
      ...prev,
      bio_json: {
        ...prev.bio_json,
        [field]: prev.bio_json[field].filter((item) => item !== value),
      },
    }));
  };

  const handlePersonaFieldChange =
    (field: keyof Omit<PersonaProfile, "likes" | "dislikes" | "stages">) =>
      (
        event: ChangeEvent<
          HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
        >
      ) => {
        const { value } = event.target;
        setFormState((prev) => {
          let nextRules = prev.bio_json.mbti_rules;
          if (field === "mbti_architype") {
            const personality = mbtiPersonalities.find((p) => p.code === value);
            if (personality) {
              nextRules = personality.rules.join("\n");
            }
          }
          return {
            ...prev,
            bio_json: {
              ...prev.bio_json,
              [field]: value,
              mbti_rules:
                field === "mbti_architype" ? nextRules : prev.bio_json.mbti_rules,
            },
          };
        });
      };

  const handlePersonaStageChange =
    (stage: keyof PersonaStages) =>
      (event: ChangeEvent<HTMLTextAreaElement>) => {
        const { value } = event.target;
        setFormState((prev) => ({
          ...prev,
          bio_json: {
            ...prev.bio_json,
            stages: {
              ...prev.bio_json.stages,
              [stage]: value,
            },
          },
        }));
      };

  const avatarPreviewSrc = resolveAvatarSrc(formState.avatarUrl);

  return (
    <AdminLayout
      title="Influencer Prompt Manager"
      subtitle="Edit influencer prompts, persona profiles, relationship-stage behavior, and knowledge."
    >
      <div className={styles["create-ai"]}>
        <AdminTwoColumn sidebar={<aside className={styles["sidebar"]}>
            <div className={styles["sidebar-top"]}>
              <div>
                <h2 className={styles["sidebar-title"]}>Influencers</h2>
                <p className={styles["sidebar-subtitle"]}>
                  Select an influencer to edit their profile.
                </p>
              </div>
            </div>

            <div className={styles["sidebar-actions"]}>
              <div className={styles["search"]}>
                <input
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  placeholder="Search by name or username"
                />
              </div>
            </div>

            <div className={styles["influencer-list"]}>
              {isLoading ? (
                <div className={styles["list-placeholder"]}>
                  Loading influencers…
                </div>
              ) : filteredInfluencers.length === 0 ? (
                <div className={styles["list-placeholder"]}>
                  No influencers found
                </div>
              ) : (
                filteredInfluencers.map((influencer) => {
                  const isActive = selectedId === influencer.id;
                  const { firstName, lastName } = splitName(influencer.name);
                  const initials =
                    `${firstName?.charAt(0) ?? ""}${lastName?.charAt(0) ?? ""
                      }`.trim() || influencer.username.charAt(0).toUpperCase();
                  const avatarSrc = resolveAvatarSrc(influencer.img);
                  return (
                    <button
                      type="button"
                      key={influencer.id}
                      className={`${styles["influencer-item"]} ${isActive ? styles["influencer-item--active"] : ""
                        }`}
                      onClick={() => setSelectedId(influencer.id)}
                    >
                      <div className={styles["influencer-item__avatar"]}>
                        {avatarSrc ? (
                          <img src={avatarSrc} alt={influencer.name} />
                        ) : initials ? (
                          <span>{initials}</span>
                        ) : (
                          <SvgPack.Profile />
                        )}
                      </div>
                      <div className={styles["influencer-item__copy"]}>
                        <span className={styles["influencer-name"]}>
                          {influencer.name}
                        </span>
                        <span className={styles["influencer-username"]}>
                          @{influencer.username}
                        </span>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </aside>}>
          <section className={styles["detail-panel"]}>
            <div className={styles["detail-card"]}>
              <div className={styles["detail-header"]}>
                <div>
                  <h2>Edit influencer</h2>
                  <p>Fill out the profile details and save your changes.</p>
                </div>
                <div className={styles["avatar-preview"]}>
                  {avatarPreviewSrc ? (
                    <img
                      src={avatarPreviewSrc}
                      alt={`${formState.firstName} ${formState.lastName}`}
                    />
                  ) : (
                    <SvgPack.Profile />
                  )}
                </div>
              </div>

              <div className={`${styles["section-card"]} ${styles["hidden"]}`}>
                <div
                  className={styles["section-card__header"]}
                  onClick={() => toggleSection("basic-info")}
                >
                  <div>
                    <h3>Basic info</h3>
                    <p>Identity, contact, and avatar details.</p>
                  </div>
                  <span className={`${styles["section-chevron"]} ${collapsedSections.has("basic-info") ? "" : styles["section-chevron--open"]}`}>▼</span>
                </div>
                {!collapsedSections.has("basic-info") && (
                  <div className={styles["section-card__body"]}>
                    <div className={styles["detail-grid"]}>
                      <div className={styles["field"]}>
                        <label htmlFor="influencer-id">Influencer ID</label>
                        <input
                          id="influencer-id"
                          value={formState.id}
                          onChange={handleFieldChange("id")}
                          placeholder="Auto-generated if left blank"
                        />
                      </div>

                      <div className={styles["field"]}>
                        <label htmlFor="influencer-first-name">First name</label>
                        <input
                          id="influencer-first-name"
                          value={formState.firstName}
                          onChange={handleFieldChange("firstName")}
                          placeholder="First name"
                        />
                      </div>

                      <div className={styles["field"]}>
                        <label htmlFor="influencer-last-name">Last name</label>
                        <input
                          id="influencer-last-name"
                          value={formState.lastName}
                          onChange={handleFieldChange("lastName")}
                          placeholder="Last name"
                        />
                      </div>

                      <div className={styles["field"]}>
                        <label htmlFor="influencer-email">Contact email</label>
                        <input
                          id="influencer-email"
                          type="email"
                          value={formState.email}
                          onChange={handleFieldChange("email")}
                          placeholder="name@example.com"
                        />
                      </div>

                      <div className={styles["field"]}>
                        <label htmlFor="influencer-phone">Contact phone</label>
                        <input
                          id="influencer-phone"
                          value={formState.phone}
                          onChange={handleFieldChange("phone")}
                          placeholder="+1 (555) 000-0000"
                        />
                      </div>

                      <div className={styles["field"]}>
                        <label htmlFor="influencer-joined-date">Joined date</label>
                        <input
                          id="influencer-joined-date"
                          type="date"
                          value={formState.created_at}
                          onChange={handleFieldChange("created_at")}
                        />
                      </div>

                      <div className={styles["field"]}>
                        <label htmlFor="influencer-avatar">Avatar URL</label>
                        <input
                          id="influencer-avatar"
                          value={formState.avatarUrl}
                          onChange={handleFieldChange("avatarUrl")}
                          placeholder="https://"
                        />
                      </div>

                      <div className={styles["field"]}>
                        <label htmlFor="influencer-voice-id">Voice ID</label>
                        <input
                          id="influencer-voice-id"
                          value={formState.voice_id}
                          onChange={handleFieldChange("voice_id")}
                          placeholder="voice_123"
                        />
                      </div>

                      <div className={styles["field"]}>
                        <label htmlFor="influencer-agent-id">
                          Elevenlabs Agent ID
                        </label>
                        <input
                          id="influencer-agent-id"
                          value={formState.influencer_agent_id_third_part}
                          onChange={handleFieldChange(
                            "influencer_agent_id_third_part"
                          )}
                          placeholder="agent_abc"
                        />
                      </div>
                    </div>
                    {sectionMsg["basic-info"] && (
                      <div className={`${styles["save-status"]} ${styles[`save-status--${sectionMsg["basic-info"]!.type}`]}`}>
                        {sectionMsg["basic-info"]!.msg}
                      </div>
                    )}
                    <button
                      type="button"
                      className={styles["primary-button"]}
                      onClick={() => patchSection("basic-info")}
                      disabled={!!sectionSaving["basic-info"] || !selectedId}
                    >
                      {sectionSaving["basic-info"] ? "Saving…" : "Save"}
                    </button>
                  </div>
                )}
              </div>

              <div className={styles["section-card"]}>
                <div
                  className={styles["section-card__header"]}
                  onClick={() => toggleSection("persona-profile")}
                >
                  <div>
                    <h3>Persona profile</h3>
                    <p>
                      Capture likes, dislikes, MBTI, tone, and stage behaviors for
                      this influencer.
                    </p>
                  </div>
                  <span className={`${styles["section-chevron"]} ${collapsedSections.has("persona-profile") ? "" : styles["section-chevron--open"]}`}>▼</span>
                </div>
                {!collapsedSections.has("persona-profile") && (
                  <div className={styles["section-card__body"]}>
                    <div className={`${styles["field"]} ${styles["hidden"]}`}>
                      <label htmlFor="persona-mbti">MBTI archetype</label>
                      <select
                        id="persona-mbti"
                        value={formState.bio_json.mbti_architype}
                        onChange={handlePersonaFieldChange("mbti_architype")}
                      >
                        <option value="">Select type</option>
                        {mbtiPersonalities.map((personality) => (
                          <option key={personality.code} value={personality.code}>
                            {personality.name} ({personality.code})
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className={`${styles["field"]} ${styles["hidden"]}`}>
                      <label htmlFor="persona-mbti-rules">MBTI rules</label>
                      <textarea
                        id="persona-mbti-rules"
                        value={formState.bio_json.mbti_rules}
                        onChange={handlePersonaFieldChange("mbti_rules")}
                        placeholder="Prefers logical decisions, needs solitary recharge, relies on structured plans."
                        rows={10}
                      />
                    </div>
                    <div className={styles["field"]}>
                      <label htmlFor="persona-rules">Personality rules</label>
                      <textarea
                        id="persona-rules"
                        value={formState.bio_json.personality_rules}
                        onChange={handlePersonaFieldChange("personality_rules")}
                        placeholder="Strategic, future-oriented, has high standards and boundaries, values long-term connections."
                        rows={10}
                      />
                    </div>
                    <div className={`${styles["field"]} ${styles["hidden"]}`}>
                      <label htmlFor="persona-tone">Tone</label>
                      <textarea
                        id="persona-tone"
                        value={formState.bio_json.tone}
                        onChange={handlePersonaFieldChange("tone")}
                        placeholder="Direct and analytical with a hint of dry humor."
                        rows={5}
                      />
                    </div>
                    <div className={styles["persona-grid"]}>
                      <div className={styles["field"]}>
                        <label htmlFor="persona-likes">
                          Likes (press Enter to add)
                        </label>
                        <input
                          id="persona-likes"
                          value={personaListDrafts.likes}
                          onChange={handlePersonaListDraftChange("likes")}
                          onKeyDown={handlePersonaListKeyDown("likes")}
                          placeholder="Type a like and press Enter"
                        />
                        <div className={styles["tag-list"]}>
                          {formState.bio_json.likes.length === 0 ? (
                            <span className={styles["tag-placeholder"]}>
                              No likes added yet
                            </span>
                          ) : (
                            formState.bio_json.likes.map((item) => (
                              <span key={item} className={styles["tag"]}>
                                {item}
                                <button
                                  type="button"
                                  className={styles["tag-remove"]}
                                  onClick={() =>
                                    handleRemovePersonaItem("likes", item)
                                  }
                                  aria-label={`Remove ${item}`}
                                >
                                  ×
                                </button>
                              </span>
                            ))
                          )}
                        </div>
                      </div>
                      <div className={styles["field"]}>
                        <label htmlFor="persona-dislikes">
                          Dislikes (press Enter to add)
                        </label>
                        <input
                          id="persona-dislikes"
                          value={personaListDrafts.dislikes}
                          onChange={handlePersonaListDraftChange("dislikes")}
                          onKeyDown={handlePersonaListKeyDown("dislikes")}
                          placeholder="Type a dislike and press Enter"
                        />
                        <div className={styles["tag-list"]}>
                          {formState.bio_json.dislikes.length === 0 ? (
                            <span className={styles["tag-placeholder"]}>
                              No dislikes added yet
                            </span>
                          ) : (
                            formState.bio_json.dislikes.map((item) => (
                              <span key={item} className={styles["tag"]}>
                                {item}
                                <button
                                  type="button"
                                  className={styles["tag-remove"]}
                                  onClick={() =>
                                    handleRemovePersonaItem("dislikes", item)
                                  }
                                  aria-label={`Remove ${item}`}
                                >
                                  ×
                                </button>
                              </span>
                            ))
                          )}
                        </div>
                      </div>
                    </div>
                    {sectionMsg["persona-profile"] && (
                      <div className={`${styles["save-status"]} ${styles[`save-status--${sectionMsg["persona-profile"]!.type}`]}`}>
                        {sectionMsg["persona-profile"]!.msg}
                      </div>
                    )}
                    <button
                      type="button"
                      className={styles["primary-button"]}
                      onClick={() => patchSection("persona-profile")}
                      disabled={!!sectionSaving["persona-profile"] || !selectedId}
                    >
                      {sectionSaving["persona-profile"] ? "Saving…" : "Save"}
                    </button>
                  </div>
                )}
              </div>

              <div className={styles["section-card"]}>
                <div
                  className={styles["section-card__header"]}
                  onClick={() => toggleSection("relationship-stages")}
                >
                  <div>
                    <h3>Relationship stages</h3>
                    <p>Select a stage to edit its behavior copy.</p>
                  </div>
                  <span className={`${styles["section-chevron"]} ${collapsedSections.has("relationship-stages") ? "" : styles["section-chevron--open"]}`}>▼</span>
                </div>
                {!collapsedSections.has("relationship-stages") && (
                  <div className={styles["section-card__body"]}>
                    <div className={styles["field"]}>
                      <label htmlFor="relationship-stages">Relationship stages</label>
                      <select
                        id="relationship-stages"
                        value={formState.bio_json.stages_focus ?? ""}
                        onChange={(event) =>
                          setFormState((prev) => ({
                            ...prev,
                            bio_json: {
                              ...prev.bio_json,
                              stages_focus: event.target.value as keyof PersonaStages,
                            },
                          }))
                        }
                      >
                        <option value="">Select stage</option>
                        {STAGE_KEYS.map((type) => (
                          <option key={type} value={type}>
                            {type.replace("_", " ").toUpperCase()}
                          </option>
                        ))}
                      </select>
                    </div>
                    {formState.bio_json.stages_focus ? (
                      <div className={styles["field"]}>
                        <label htmlFor="persona-stage-copy">
                          {formState.bio_json.stages_focus
                            .replace("_", " ")
                            .toUpperCase()}
                        </label>
                        <textarea
                          id="persona-stage-copy"
                          value={
                            formState.bio_json.stages[
                            formState.bio_json.stages_focus as keyof PersonaStages
                            ] || ""
                          }
                          onChange={handlePersonaStageChange(
                            formState.bio_json.stages_focus as keyof PersonaStages
                          )}
                          placeholder={
                            STAGE_PLACEHOLDERS[
                            formState.bio_json.stages_focus as keyof PersonaStages
                            ]
                          }
                          rows={3}
                        />
                      </div>
                    ) : (
                      <div className={styles["field"]}>
                        <label>Stage copy</label>
                        <div className={styles["list-placeholder"]}>
                          Select a stage to edit its copy.
                        </div>
                      </div>
                    )}
                    {sectionMsg["relationship-stages"] && (
                      <div className={`${styles["save-status"]} ${styles[`save-status--${sectionMsg["relationship-stages"]!.type}`]}`}>
                        {sectionMsg["relationship-stages"]!.msg}
                      </div>
                    )}
                    <button
                      type="button"
                      className={styles["primary-button"]}
                      onClick={() => patchSection("relationship-stages")}
                      disabled={!!sectionSaving["relationship-stages"] || !selectedId}
                    >
                      {sectionSaving["relationship-stages"] ? "Saving…" : "Save"}
                    </button>
                  </div>
                )}
              </div>

              {/* ── Knowledge base ── */}
              <div className={styles["section-card"]}>
                <div
                  className={styles["section-card__header"]}
                  onClick={() => toggleSection("knowledge")}
                >
                  <div>
                    <h3>Knowledge base</h3>
                    <p>Long-form knowledge text indexed for AI retrieval.</p>
                  </div>
                  <span className={`${styles["section-chevron"]} ${collapsedSections.has("knowledge") ? "" : styles["section-chevron--open"]}`}>▼</span>
                </div>
                {!collapsedSections.has("knowledge") && (
                  <div className={styles["section-card__body"]}>
                    {loadingKb && (
                      <div style={{ opacity: 0.55, fontSize: 13 }}>Loading knowledge…</div>
                    )}
                    {!loadingKb && !hasKb && (
                      <div style={{ fontSize: 13, opacity: 0.6 }}>No knowledge yet — enter text below and save.</div>
                    )}
                    {!loadingKb && hasKb && kbData && (
                      <div style={{ fontSize: 12, opacity: 0.65 }}>
                        {kbData.chunk_count} chunk{kbData.chunk_count !== 1 ? "s" : ""}
                        {kbData.updated_at && ` · Updated ${new Date(kbData.updated_at).toLocaleString()}`}
                      </div>
                    )}
                    {!loadingKb && (
                      <div className={styles["field"]}>
                        <textarea
                          value={kbText}
                          onChange={(e) => setKbText(e.target.value)}
                          placeholder="Enter long-form knowledge text for this influencer…"
                          rows={10}
                          disabled={savingKb}
                        />
                      </div>
                    )}
                    {kbSuccess && (
                      <div className={`${styles["save-status"]} ${styles["save-status--success"]}`}>{kbSuccess}</div>
                    )}
                    {kbError && (
                      <div className={`${styles["save-status"]} ${styles["save-status--error"]}`}>{kbError}</div>
                    )}
                    {!loadingKb && (
                      <button
                        type="button"
                        className={styles["primary-button"]}
                        onClick={handleKbSave}
                        disabled={savingKb || !kbText.trim() || !selectedId}
                      >
                        {savingKb ? "Saving…" : "Save knowledge"}
                      </button>
                    )}
                  </div>
                )}
              </div>
              {!selectedId && (
                <div className={styles["form-footer"]}>
                  <span className={styles["save-status"]}>
                    No influencers found to edit.
                  </span>
                </div>
              )}
            </div>
          </section>
        </AdminTwoColumn>
      </div>
    </AdminLayout>
  );
};

export default CreateInfluencer;
