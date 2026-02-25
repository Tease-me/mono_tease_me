import defaultAvatar from "@/assets/image/avatar.png";
import mbtiData from "@/data/mbti.json";
import { InfluencerDataModel } from "@/data/models/InfluencerDataModel";
import { InfluencerRepo } from "@/data/repositories/InfluencerRepo";
import { Modal } from "@/ui/components/modals/Modal";
import { splitName } from "@/utils/StringUtils";
import SvgPack from "@/utils/SvgPack";
import React, {
  ChangeEvent,
  FormEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import AdminLayout from "../AdminLayout";
import styles from "./CreateInfluencer.module.css";

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
  custom_adult_prompt: string;
  influencer_agent_id_third_part: string;
  bio_json: PersonaProfile;
  fp_ref_id?: string | null;
};

type UploadRecord = Record<string, unknown>;

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
const formatRecordKey = (key: string) =>
  key.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());

const formatRecordValue = (value: unknown): string => {
  if (value === null || value === undefined) return "";
  if (Array.isArray(value)) {
    return value
      .map((item) =>
        typeof item === "object" ? JSON.stringify(item) : String(item)
      )
      .join(", ");
  }
  if (typeof value === "object") {
    return JSON.stringify(value, null, 2);
  }
  return String(value);
};

const isRecord = (value: unknown): value is UploadRecord =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const parseCsvText = (text: string): UploadRecord[] => {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentValue = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (char === '"') {
      if (inQuotes && text[i + 1] === '"') {
        currentValue += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && text[i + 1] === "\n") {
        i += 1;
      }
      currentRow.push(currentValue.trim());
      currentValue = "";
      if (currentRow.some((value) => value.length > 0)) {
        rows.push(currentRow);
      }
      currentRow = [];
      continue;
    }

    if (char === "," && !inQuotes) {
      currentRow.push(currentValue.trim());
      currentValue = "";
      continue;
    }
    currentValue += char;
  }

  currentRow.push(currentValue.trim());
  if (currentRow.some((value) => value.length > 0)) {
    rows.push(currentRow);
  }

  if (rows.length < 1) {
    return [];
  }

  const headers = rows[0];
  if (rows.length === 1) {
    return [];
  }

  return rows.slice(1).map((row) => {
    return headers.reduce<UploadRecord>((acc, header, index) => {
      const key = header || `column_${index + 1}`;
      acc[key] = row[index] ?? "";
      return acc;
    }, {});
  });
};

const parseUploadFileContent = (content: string): UploadRecord[] => {
  const trimmed = content.trim();
  if (!trimmed) {
    return [];
  }
  try {
    const parsed = JSON.parse(trimmed);
    if (Array.isArray(parsed)) {
      return parsed.filter(isRecord);
    }
    if (isRecord(parsed)) {
      return [parsed];
    }
  } catch {
    // Fallback to CSV parsing if JSON parsing fails
  }
  return parseCsvText(content);
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
  custom_adult_prompt: "",
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
    custom_adult_prompt: influencer.custom_adult_prompt ?? "",
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
  const [selectedId, setSelectedId] = useState<string | "new" | null>(null);
  const [formState, setFormState] = useState<InfluencerFormState>(() =>
    createDefaultFormState()
  );
  const [searchTerm, setSearchTerm] = useState("");
  const [csvFileName, setCsvFileName] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [saveState, setSaveState] = useState<
    "idle" | "saving" | "success" | "error"
  >("idle");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [uploadRecords, setUploadRecords] = useState<UploadRecord[]>([]);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [uploadParseError, setUploadParseError] = useState<string | null>(null);
  const [expandedRecords, setExpandedRecords] = useState<Set<number>>(
    () => new Set<number>()
  );
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(
    () => new Set(["basic-info", "prompt-overrides", "relationship-stages"])
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
  const fileInputRef = useRef<HTMLInputElement>(null);

  const getRecordLabel = (record: UploadRecord, index: number) => {
    const candidateKeys: Array<keyof UploadRecord> = [
      "display_name",
      "name",
      "username",
      "id",
    ];
    for (const key of candidateKeys) {
      const value = record[key];
      if (typeof value === "string" && value.trim().length > 0) {
        return value;
      }
    }
    return `Row ${index + 1}`;
  };

  useEffect(() => {
    let isMounted = true;
    (async () => {
      setIsLoading(true);
      try {
        const data = await influencerRepo.getInfluencers();
        if (!isMounted) return;
        setInfluencers(data);
        setSelectedId(data.length ? data[0].id : "new");
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    })();

    return () => {
      isMounted = false;
    };
  }, [influencerRepo]);

  useEffect(() => {
    if (selectedId === "new") {
      setFormState(createDefaultFormState());
      return;
    }

    if (selectedId === null) {
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

  useEffect(() => {
    if (saveState === "success" || saveState === "error") {
      const timeout = setTimeout(() => {
        setSaveState("idle");
        setSaveError(null);
      }, 3000);
      return () => clearTimeout(timeout);
    }
    return undefined;
  }, [saveState]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const existing =
      selectedId !== "new"
        ? influencers.find((influencer) => influencer.id === selectedId)
        : undefined;
    const nameFromFields =
      `${formState.firstName} ${formState.lastName}`.trim();
    const normalizedNameForUsername = nameFromFields
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "");
    const username =
      existing?.username || normalizedNameForUsername || "new_influencer";
    const fullName = nameFromFields || existing?.name || "New Influencer";
    const thirdPartyAgentId =
      formState.influencer_agent_id_third_part ||
      existing?.influencer_agent_id_third_part ||
      "";
    const base: InfluencerDataModel = {
      id: formState.id || existing?.id || Date.now().toString(),
      name: fullName,
      username,
      img: resolveAvatarSrc(formState.avatarUrl),
      created_at:
        formState.created_at ||
        existing?.created_at ||
        new Date().toISOString().slice(0, 10),
      earnings: existing?.earnings ?? 0,
      isSelected: false,
      voice_id: formState.voice_id || existing?.voice_id || "",
      custom_adult_prompt:
        formState.custom_adult_prompt || existing?.custom_adult_prompt || "",
      prompt_template:
        formState.prompt_template || existing?.prompt_template || "",
      influencer_agent_id_third_part: thirdPartyAgentId,
      bio_json: personaProfileToJson(formState.bio_json),
      daily_scripts: existing?.daily_scripts ?? [],
    };
    const isNewInfluencer = selectedId === "new" || !existing;
    setSaveState("saving");
    setSaveError(null);
    try {
      const serverInfluencer = isNewInfluencer
        ? await influencerRepo.createInfluencer(base)
        : await influencerRepo.patchInfluencer(
          base,
          base.prompt_template,
          existing?.daily_scripts || [],
          base.influencer_agent_id_third_part,
          base.bio_json,
          base.voice_id,
          base.custom_adult_prompt
        );
      const mergedInfluencer = {
        ...base,
        ...serverInfluencer,
        custom_adult_prompt:
          serverInfluencer.custom_adult_prompt ?? base.custom_adult_prompt,
      };
      setInfluencers((prev) => {
        const index = prev.findIndex(
          (influencer) => influencer.id === mergedInfluencer.id
        );
        if (index === -1) {
          return [mergedInfluencer, ...prev];
        }
        const next = [...prev];
        next[index] = mergedInfluencer;
        return next;
      });
      setSelectedId(mergedInfluencer.id);
      setSaveState("success");
    } catch (err) {
      console.error("Failed to save influencer:", err);
      setSaveState("error");
      setSaveError(err instanceof Error ? err.message : "Unknown error");
    }
  };

  const handleCreateNew = () => {
    setSelectedId("new");
    setFormState(createDefaultFormState());
  };

  const handleReset = () => {
    if (selectedId === "new" || selectedId === null) {
      setFormState(createDefaultFormState());
      return;
    }
    const selected = influencers.find(
      (influencer) => influencer.id === selectedId
    );
    if (selected) {
      setFormState(createFormStateFromInfluencer(selected));
    }
  };

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      setCsvFileName(null);
      setUploadRecords([]);
      setIsUploadModalOpen(false);
      return;
    }
    setCsvFileName(file.name);
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const text = String(reader.result ?? "");
        const parsed = parseUploadFileContent(text);
        if (parsed.length === 0) {
          throw new Error("No rows detected in the uploaded file.");
        }
        setUploadRecords(parsed);
        setExpandedRecords(new Set<number>());
        setUploadParseError(null);
        setIsUploadModalOpen(true);
      } catch (err) {
        console.error("Failed to parse uploaded file:", err);
        setUploadRecords([]);
        setIsUploadModalOpen(false);
        setUploadParseError(
          err instanceof Error
            ? err.message
            : "Unable to parse the uploaded file."
        );
      }
    };
    reader.onerror = () => {
      console.error("Failed to read uploaded file:", reader.error);
      setUploadParseError("Failed to read the selected file.");
    };
    reader.readAsText(file);
    event.target.value = "";
  };

  const toggleRecordExpansion = (index: number) => {
    setExpandedRecords((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  const closeUploadModal = () => {
    setIsUploadModalOpen(false);
  };

  const avatarPreviewSrc = resolveAvatarSrc(formState.avatarUrl);

  return (
    <AdminLayout
      title="Influencer Manager"
      subtitle="Create or edit influencer profiles and prompts."
      headerRight={
        <div className={styles["upload-status-group"]}>
          {csvFileName && (
            <span className={styles["upload-feedback"]}>
              Imported: {csvFileName}
            </span>
          )}
          {uploadParseError && (
            <span className={styles["upload-error"]}>{uploadParseError}</span>
          )}
        </div>
      }
    >
      <div className={styles["create-ai"]}>
        <div className={styles["create-ai__layout"]}>
          <aside className={styles["sidebar"]}>
            <div className={styles["sidebar-top"]}>
              <div>
                <h2 className={styles["sidebar-title"]}>Influencers</h2>
                <p className={styles["sidebar-subtitle"]}>
                  Select to edit or create a new profile.
                </p>
              </div>
              <button
                type="button"
                className={styles["upload-button"]}
                onClick={handleUploadClick}
              >
                Upload CSV
              </button>
              <input
                className={styles["file-input"]}
                ref={fileInputRef}
                type="file"
                accept=".csv"
                onChange={handleFileChange}
              />
            </div>

            <div className={styles["sidebar-actions"]}>
              <button
                type="button"
                className={styles["new-button"]}
                onClick={handleCreateNew}
              >
                + New Influencer
              </button>
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
          </aside>

          <section className={styles["detail-panel"]}>
            <form className={styles["detail-card"]} onSubmit={handleSubmit}>
              <div className={styles["detail-header"]}>
                <div>
                  <h2>
                    {selectedId === "new"
                      ? "Create new influencer"
                      : "Edit influencer"}
                  </h2>
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

              <div className={styles["section-card"]}>
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
                  </div>
                )}
              </div>

              <div className={styles["section-card"]}>
                <div
                  className={styles["section-card__header"]}
                  onClick={() => toggleSection("prompt-overrides")}
                >
                  <div>
                    <h3>18+ Prompt overrides</h3>
                    <p>Customize 18+ prompt text used for adult content workflows.</p>
                  </div>
                  <span className={`${styles["section-chevron"]} ${collapsedSections.has("prompt-overrides") ? "" : styles["section-chevron--open"]}`}>▼</span>
                </div>
                {!collapsedSections.has("prompt-overrides") && (
                  <div className={styles["section-card__body"]}>
                    <div className={styles["field"]}>
                      <label htmlFor="influencer-custom-adult-prompt">
                        Custom adult prompt (For Voice Message 18+ Only)
                      </label>
                      <textarea
                        id="influencer-custom-adult-prompt"
                        value={formState.custom_adult_prompt}
                        onChange={handleFieldChange("custom_adult_prompt")}
                        placeholder="Provide a custom adult prompt override."
                        rows={6}
                      />
                    </div>
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
                  </div>
                )}
              </div>
              <div className={styles["form-footer"]}>
                {saveState !== "idle" && (
                  <span
                    className={`${styles["save-status"]} ${saveState === "success"
                      ? styles["save-status--success"]
                      : ""
                      } ${saveState === "error" ? styles["save-status--error"] : ""
                      }`}
                  >
                    {saveState === "success" && "Changes saved"}
                    {saveState === "error" &&
                      (saveError || "Failed to save changes")}
                    {saveState === "saving" && "Saving…"}
                  </span>
                )}
                <button
                  type="button"
                  className={styles["secondary-button"]}
                  onClick={handleReset}
                >
                  Reset
                </button>
                <button
                  type="submit"
                  className={styles["primary-button"]}
                  disabled={saveState === "saving"}
                >
                  {saveState === "saving" ? "Saving…" : "Save changes"}
                </button>
              </div>
            </form>
          </section>
        </div>
        <Modal
          isOpen={isUploadModalOpen}
          onClose={closeUploadModal}
          size="lg"
          ariaLabel="Uploaded influencer data preview"
          closeOnOverlayClick
        >
          <div className={styles["upload-modal"]}>
            <div className={styles["upload-modal__header"]}>
              <div>
                <h3>Imported records</h3>
                <p>
                  {csvFileName ? `${csvFileName} • ` : ""}
                  {uploadRecords.length} row
                  {uploadRecords.length === 1 ? "" : "s"}
                </p>
              </div>
              <button
                type="button"
                className={styles["upload-modal__close"]}
                onClick={closeUploadModal}
              >
                Close
              </button>
            </div>
            {uploadRecords.length === 0 ? (
              <div className={styles["upload-modal__empty"]}>
                No data to preview yet.
              </div>
            ) : (
              <ul className={styles["upload-modal__list"]}>
                {uploadRecords.map((record, index) => {
                  const isExpanded = expandedRecords.has(index);
                  const label = getRecordLabel(record, index);
                  const entries = Object.entries(record);
                  return (
                    <li
                      key={`${label}-${index}`}
                      className={styles["upload-modal__item"]}
                    >
                      <button
                        type="button"
                        className={`${styles["upload-modal__toggle"]} ${isExpanded
                          ? styles["upload-modal__toggle--expanded"]
                          : ""
                          }`}
                        onClick={() => toggleRecordExpansion(index)}
                        aria-expanded={isExpanded}
                      >
                        <span>{label}</span>
                        <span className={styles["upload-modal__chevron"]}>
                          {isExpanded ? "-" : "+"}
                        </span>
                      </button>
                      {isExpanded && (
                        <div className={styles["upload-modal__body"]}>
                          {entries.map(([key, value]) => {
                            const formattedValue = formatRecordValue(value);
                            const isMultiline = /\n/.test(formattedValue);
                            return (
                              <div
                                key={key}
                                className={styles["upload-modal__row"]}
                              >
                                <span className={styles["upload-modal__key"]}>
                                  {formatRecordKey(key)}
                                </span>
                                {isMultiline ? (
                                  <pre
                                    className={
                                      styles["upload-modal__value-pre"]
                                    }
                                  >
                                    {formattedValue}
                                  </pre>
                                ) : (
                                  <span
                                    className={styles["upload-modal__value"]}
                                  >
                                    {formattedValue}
                                  </span>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </Modal>
      </div>
    </AdminLayout>
  );
};

export default CreateInfluencer;
