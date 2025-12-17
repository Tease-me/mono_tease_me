import React, { ChangeEvent, FormEvent, useEffect, useMemo, useRef, useState } from "react";
import styles from "./CreateInfluencer.module.css";
import SvgPack from "@/utils/SvgPack";
import { InfluencerDataModel } from "@/data/models/InfluencerDataModel";
import { InfluencerRepo } from "@/data/repositories/InfluencerRepo";
import { Modal } from "@/ui/components/modals/Modal";
import { splitName } from "@/utils/StringUtils";
import { KnowledgeFileModel } from "@/data/models/InfluencerDataModel";
import defaultAvatar from "@/assets/image/avatar.png";
import AdminLayout from "../AdminLayout";

type SocialConnections = {
    instagram: boolean;
    facebook: boolean;
    onlyfans: boolean;
    twitter: boolean;
};

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
    voice_prompt: string;
    social_connections: SocialConnections;
    persona_profile: PersonaProfile;
};

type UploadRecord = Record<string, unknown>;

type PersonaStages = {
    hate: string;
    dislike: string;
    strangers: string;
    talking: string;
    flirting: string;
    dating: string;
    in_love: string;
};

type PersonaProfile = {
    likes: string[];
    dislikes: string[];
    mbti_architype: string;
    mbti_rules: string;
    personality_rules: string;
    tone: string;
    stages: PersonaStages;
};

const formatRecordKey = (key: string) => key.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());

const formatRecordValue = (value: unknown): string => {
    if (value === null || value === undefined) return "";
    if (Array.isArray(value)) {
        return value
            .map((item) => (typeof item === "object" ? JSON.stringify(item) : String(item)))
            .join(", ");
    }
    if (typeof value === "object") {
        return JSON.stringify(value, null, 2);
    }
    return String(value);
};

const isRecord = (value: unknown): value is UploadRecord => typeof value === "object" && value !== null && !Array.isArray(value);

const parseCsvText = (text: string): UploadRecord[] => {
    const rows: string[][] = [];
    let currentRow: string[] = [];
    let currentValue = "";
    let inQuotes = false;

    for (let i = 0; i < text.length; i += 1) {
        const char = text[i];
        if (char === "\"") {
            if (inQuotes && text[i + 1] === "\"") {
                currentValue += "\"";
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
        const normalizedYear = year.length === 2 ? `20${year}` : year.padStart(4, "0");
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

const createDefaultSocialConnections = (): SocialConnections => ({
    instagram: false,
    facebook: false,
    onlyfans: false,
    twitter: false,
});

const resolveAvatarSrc = (value?: string | null) => {
    if (typeof value === "string") {
        const trimmed = value.trim();
        if (trimmed.length > 0) {
            return trimmed;
        }
    }
    return defaultAvatar;
};

const DEMO_PERSONA_PROFILE: PersonaProfile = {
    likes: [
        "Daal Vaat",
        "Chinese food",
        "Water",
        "Salty snacks",
        "Chatapate",
        "Teal",
        "Tortoise",
        "Autumn weather",
        "Coding",
        "YouTube",
        "Casual parties",
        "Country music",
        "Careless Whisper",
        "Breaking Bad",
        "Watching movies at home",
    ],
    dislikes: [
        "Cold Drinks",
        "Rotten smells",
        "Indian movies",
        "Liars",
        "Show-offs",
        "Ghosts",
        "Heights",
        "Cold winters",
        "Spiders",
        "Antarctica",
        "Onion cutting",
        "Smoking",
        "Murders",
    ],
    mbti_architype: "INTJ",
    mbti_rules: "Prefers logical decisions, needs solitary recharge, relies on structured plans.",
    personality_rules: "Strategic, future-oriented, has high standards and boundaries, values long-term connections.",
    tone: "Direct and analytical with a hint of dry humor.",
    stages: {
        hate: "Avoids interaction and stays quiet.",
        dislike: "Remains silent and distant.",
        strangers: "Observes quietly, initially reserved.",
        talking: "Engages in meaningful conversation but remains private.",
        flirting: "Shows interest through subtle actions.",
        dating: "Plans meticulously and shows affection through acts of service.",
        in_love: "Demonstrates deep care and commitment, prioritizes long-term connection.",
    },
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
        talking: "",
        flirting: "",
        dating: "",
        in_love: "",
    },
});

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
    voice_prompt: "",
    social_connections: createDefaultSocialConnections(),
    persona_profile: createDefaultPersonaProfile(),
});

function createFormStateFromInfluencer(influencer: InfluencerDataModel): InfluencerFormState {
    const { firstName, lastName } = splitName(influencer.name);
    const incomingSocial = influencer.social_connections ?? createDefaultSocialConnections();
    const normalizedAvatar = (influencer.img ?? "").trim();
    const avatarUrl = normalizedAvatar && normalizedAvatar !== defaultAvatar ? normalizedAvatar : "";
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
        influencer_agent_id_third_part: influencer.influencer_agent_id_third_part ?? "",
        voice_prompt: influencer.voice_prompt ?? "",
        social_connections: {
            instagram: incomingSocial.instagram ?? false,
            facebook: incomingSocial.facebook ?? false,
            onlyfans: incomingSocial.onlyfans ?? false,
            twitter: incomingSocial.twitter ?? false,
        },
        persona_profile: createDefaultPersonaProfile(),
    };
}

const CreateInfluencer: React.FC = () => {
    const [influencers, setInfluencers] = useState<InfluencerDataModel[]>([]);
    const [selectedId, setSelectedId] = useState<string | "new" | null>(null);
    const [formState, setFormState] = useState<InfluencerFormState>(() => createDefaultFormState());
    const [searchTerm, setSearchTerm] = useState("");
    const [csvFileName, setCsvFileName] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [saveState, setSaveState] = useState<"idle" | "saving" | "success" | "error">("idle");
    const [saveError, setSaveError] = useState<string | null>(null);
    const [uploadRecords, setUploadRecords] = useState<UploadRecord[]>([]);
    const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
    const [uploadParseError, setUploadParseError] = useState<string | null>(null);
    const [expandedRecords, setExpandedRecords] = useState<Set<number>>(() => new Set<number>());
    const [promptSaveState, setPromptSaveState] = useState<"idle" | "saving" | "success" | "error">("idle");
    // const [voicePromptSaveState, setVoicePromptSaveState] = useState<"idle" | "saving" | "success" | "error">("idle");
    const [promptSaveError, setPromptSaveError] = useState<string | null>(null);
    // const [voicePromptSaveError, setVoicePromptSaveError] = useState<string | null>(null);
    const [knowledgeFiles, setKnowledgeFiles] = useState<KnowledgeFileModel[]>([]);
    const [knowledgeLoading, setKnowledgeLoading] = useState(false);
    const [knowledgeError, setKnowledgeError] = useState<string | null>(null);
    const [knowledgeUploading, setKnowledgeUploading] = useState(false);
    const influencerRepo = useMemo(() => InfluencerRepo(), []);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const knowledgeFileInputRef = useRef<HTMLInputElement>(null);

    const getRecordLabel = (record: UploadRecord, index: number) => {
        const candidateKeys: Array<keyof UploadRecord> = ["display_name", "name", "username", "id"];
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

        const selected = influencers.find((influencer) => influencer.id === selectedId);
        if (selected) {
            setFormState(createFormStateFromInfluencer(selected));
        }

        setFormState((prev) => ({
            ...prev,
            persona_profile: DEMO_PERSONA_PROFILE,
        }));
    }, [selectedId, influencers]);

    useEffect(() => {
        if (!selectedId || selectedId === "new") {
            setKnowledgeFiles([]);
            setKnowledgeError(null);
            return;
        }
        let isCancelled = false;
        const fetchFiles = async () => {
            setKnowledgeLoading(true);
            setKnowledgeError(null);
            try {
                const files = await influencerRepo.listKnowledgeFiles(selectedId);
                if (!isCancelled) {
                    setKnowledgeFiles(files);
                }
            } catch (err) {
                if (!isCancelled) {
                    setKnowledgeError(err instanceof Error ? err.message : "Unable to load documents");
                }
            } finally {
                if (!isCancelled) {
                    setKnowledgeLoading(false);
                }
            }
        };
        fetchFiles();
        return () => {
            isCancelled = true;
        };
    }, [selectedId, influencerRepo]);

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

    const handleFieldChange = (field: keyof InfluencerFormState) => (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { value } = event.target;
        setFormState((prev) => ({ ...prev, [field]: value }));
    };

    const handlePersonaListChange = (field: "likes" | "dislikes") => (event: ChangeEvent<HTMLTextAreaElement>) => {
        const { value } = event.target;
        const items = value
            .split("\n")
            .map((line) => line.trim())
            .filter(Boolean);
        setFormState((prev) => ({
            ...prev,
            persona_profile: {
                ...prev.persona_profile,
                [field]: items,
            },
        }));
    };

    const handlePersonaFieldChange = (field: keyof Omit<PersonaProfile, "likes" | "dislikes" | "stages">) =>
        (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
            const { value } = event.target;
            setFormState((prev) => ({
                ...prev,
                persona_profile: {
                    ...prev.persona_profile,
                    [field]: value,
                },
            }));
        };

    const handlePersonaStageChange = (stage: keyof PersonaStages) => (event: ChangeEvent<HTMLTextAreaElement>) => {
        const { value } = event.target;
        setFormState((prev) => ({
            ...prev,
            persona_profile: {
                ...prev.persona_profile,
                stages: {
                    ...prev.persona_profile.stages,
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

    useEffect(() => {
        if (promptSaveState === "success" || promptSaveState === "error") {
            const timeout = setTimeout(() => {
                setPromptSaveState("idle");
                setPromptSaveError(null);
            }, 3000);
            return () => clearTimeout(timeout);
        }
        return undefined;
    }, [promptSaveState]);

    // useEffect(() => {
    //     if (voicePromptSaveState === "success" || voicePromptSaveState === "error") {
    //         const timeout = setTimeout(() => {
    //             setVoicePromptSaveState("idle");
    //             setVoicePromptSaveError(null);
    //         }, 3000);
    //         return () => clearTimeout(timeout);
    //     }
    //     return undefined;
    // }, [voicePromptSaveState]);

    const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        const existing = selectedId !== "new" ? influencers.find((influencer) => influencer.id === selectedId) : undefined;
        const nameFromFields = `${formState.firstName} ${formState.lastName}`.trim();
        const normalizedNameForUsername = nameFromFields
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "_")
            .replace(/^_+|_+$/g, "");
        const username = existing?.username || normalizedNameForUsername || "new_influencer";
        const fullName = nameFromFields || existing?.name || "New Influencer";
        const thirdPartyAgentId = formState.influencer_agent_id_third_part || existing?.influencer_agent_id_third_part || "";
        const base: InfluencerDataModel = {
            id: formState.id || existing?.id || Date.now().toString(),
            name: fullName,
            username,
            img: resolveAvatarSrc(formState.avatarUrl),
            created_at: formState.created_at || existing?.created_at || new Date().toISOString().slice(0, 10),
            earnings: existing?.earnings ?? 0,
            isSelected: false,
            voice_id: formState.voice_id || existing?.voice_id || "",
            prompt_template: formState.prompt_template || existing?.prompt_template || "",
            influencer_agent_id_third_part: thirdPartyAgentId,
            voice_prompt: formState.voice_prompt || existing?.voice_prompt || "",
            social_connections: { ...formState.social_connections },
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
                    base.voice_prompt,
                    base.voice_id,
                );
            const mergedInfluencer = {
                ...base,
                ...serverInfluencer,
            };
            setInfluencers((prev) => {
                const index = prev.findIndex((influencer) => influencer.id === mergedInfluencer.id);
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

    const updateInfluencerCollection = (updated: InfluencerDataModel) => {
        setInfluencers((prev) => {
            const index = prev.findIndex((influencer) => influencer.id === updated.id);
            if (index === -1) {
                return [updated, ...prev];
            }
            const next = [...prev];
            next[index] = { ...next[index], ...updated };
            return next;
        });
        setSelectedId(updated.id);
    };

    const handlePromptTemplateSave = async () => {
        if (!selectedId || selectedId === "new") {
            setPromptSaveState("error");
            setPromptSaveError("Select an influencer to update the prompt.");
            return;
        }
        const existing = influencers.find((influencer) => influencer.id === selectedId);
        if (!existing) {
            setPromptSaveState("error");
            setPromptSaveError("Influencer not found.");
            return;
        }

        const payload: InfluencerDataModel = {
            ...existing,
            prompt_template: formState.prompt_template,
            influencer_agent_id_third_part: existing.influencer_agent_id_third_part,
            voice_prompt: existing.voice_prompt,
            voice_id: formState.voice_id || existing.voice_id,
        };

        setPromptSaveState("saving");
        setPromptSaveError(null);

        try {
            const serverInfluencer = await influencerRepo.patchInfluencer(
                payload,
                payload.prompt_template,
                payload.daily_scripts,
                payload.influencer_agent_id_third_part,
                payload.voice_prompt,
                payload.voice_id,
            );
            const mergedInfluencer = { ...payload, ...serverInfluencer };
            updateInfluencerCollection(mergedInfluencer);
            setFormState((prev) => ({
                ...prev,
                id: mergedInfluencer.id,
                prompt_template: mergedInfluencer.prompt_template ?? prev.prompt_template
            }));
            setPromptSaveState("success");
        } catch (err) {
            console.error("Failed to save prompt:", err);
            setPromptSaveState("error");
            setPromptSaveError(err instanceof Error ? err.message : "Unable to save prompt");
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
        const selected = influencers.find((influencer) => influencer.id === selectedId);
        if (selected) {
            setFormState(createFormStateFromInfluencer(selected));
        }
    };

    const handleUploadClick = () => {
        fileInputRef.current?.click();
    };

    const handleKnowledgeUploadClick = () => {
        knowledgeFileInputRef.current?.click();
    };

    const formatFileSize = (bytes: number) => {
        if (!bytes) return "0 B";
        const sizes = ["B", "KB", "MB", "GB"];
        const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), sizes.length - 1);
        return `${(bytes / 1024 ** i).toFixed(i === 0 ? 0 : 1)} ${sizes[i]}`;
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
                setUploadParseError(err instanceof Error ? err.message : "Unable to parse the uploaded file.");
            }
        };
        reader.onerror = () => {
            console.error("Failed to read uploaded file:", reader.error);
            setUploadParseError("Failed to read the selected file.");
        };
        reader.readAsText(file);
        event.target.value = "";
    };

    const handleKnowledgeFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file || !selectedId || selectedId === "new") {
            event.target.value = "";
            return;
        }
        setKnowledgeUploading(true);
        setKnowledgeError(null);
        try {
            const uploaded = await influencerRepo.uploadKnowledgeFile(selectedId, file);
            setKnowledgeFiles((prev) => [uploaded, ...prev]);
        } catch (err) {
            setKnowledgeError(err instanceof Error ? err.message : "Failed to upload document");
        } finally {
            setKnowledgeUploading(false);
            event.target.value = "";
        }
    };

    const handleKnowledgeDelete = async (fileId: number) => {
        if (!selectedId || selectedId === "new") return;
        try {
            await influencerRepo.deleteKnowledgeFile(selectedId, fileId);
            setKnowledgeFiles((prev) => prev.filter((file) => file.id !== fileId));
        } catch (err) {
            setKnowledgeError(err instanceof Error ? err.message : "Failed to delete document");
        }
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
                    {csvFileName && <span className={styles["upload-feedback"]}>Imported: {csvFileName}</span>}
                    {uploadParseError && <span className={styles["upload-error"]}>{uploadParseError}</span>}
                </div>
            }
        >
            <div className={styles["create-ai"]}>
                <div className={styles["create-ai__layout"]}>
                    <aside className={styles["sidebar"]}>
                        <div className={styles["sidebar-top"]}>
                            <div>
                                <h2 className={styles["sidebar-title"]}>Influencers</h2>
                                <p className={styles["sidebar-subtitle"]}>Select to edit or create a new profile.</p>
                            </div>
                            <button type="button" className={styles["upload-button"]} onClick={handleUploadClick}>
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
                            <button type="button" className={styles["new-button"]} onClick={handleCreateNew}>
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
                                <div className={styles["list-placeholder"]}>Loading influencers…</div>
                            ) : filteredInfluencers.length === 0 ? (
                                <div className={styles["list-placeholder"]}>No influencers found</div>
                            ) : (
                                filteredInfluencers.map((influencer) => {
                                    const isActive = selectedId === influencer.id;
                                    const { firstName, lastName } = splitName(influencer.name);
                                    const initials = `${firstName?.charAt(0) ?? ""}${lastName?.charAt(0) ?? ""}`.trim() ||
                                        influencer.username.charAt(0).toUpperCase();
                                    const avatarSrc = resolveAvatarSrc(influencer.img);
                                    return (
                                        <button
                                            type="button"
                                            key={influencer.id}
                                            className={`${styles["influencer-item"]} ${isActive ? styles["influencer-item--active"] : ""}`}
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
                                                <span className={styles["influencer-name"]}>{influencer.name}</span>
                                                <span className={styles["influencer-username"]}>@{influencer.username}</span>
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
                                    <h2>{selectedId === "new" ? "Create new influencer" : "Edit influencer"}</h2>
                                    <p>Fill out the profile details and save your changes.</p>
                                </div>
                                <div className={styles["avatar-preview"]}>
                                    {avatarPreviewSrc ? (
                                        <img src={avatarPreviewSrc} alt={`${formState.firstName} ${formState.lastName}`} />
                                    ) : (
                                        <SvgPack.Profile />
                                    )}
                                </div>
                            </div>

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
                                    <label htmlFor="influencer-agent-id">Elevenlabs Agent ID</label>
                                    <input
                                        id="influencer-agent-id"
                                        value={formState.influencer_agent_id_third_part}
                                        onChange={handleFieldChange("influencer_agent_id_third_part")}
                                        placeholder="agent_abc"
                                    />
                                </div>
                            </div>

                            <div className={`${styles["section-heading"]} ${styles["section-heading--row"]}`}>
                                <div>
                                    <h3>Persona profile</h3>
                                    <p>Capture likes, dislikes, MBTI, tone, and stage behaviors for this influencer.</p>
                                </div>
                            </div>
                            <div className={styles["field"]}>
                                <label htmlFor="persona-mbti">MBTI archetype</label>
                                <select
                                    id="persona-mbti"
                                    value={formState.persona_profile.mbti_architype}
                                    onChange={handlePersonaFieldChange("mbti_architype")}
                                >
                                    <option value="">Select type</option>
                                    {["ISTJ", "ISFJ", "INFJ", "INTJ", "ISTP", "ISFP", "INFP", "INTP", "ESTP", "ESFP", "ENFP", "ENTP", "ESTJ", "ESFJ", "ENFJ", "ENTJ"].map((type) => (
                                        <option key={type} value={type}>
                                            {type}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div className={styles["field"]}>
                                <label htmlFor="persona-mbti-rules">MBTI rules</label>
                                <textarea
                                    id="persona-mbti-rules"
                                    value={formState.persona_profile.mbti_rules}
                                    onChange={handlePersonaFieldChange("mbti_rules")}
                                    placeholder="Prefers logical decisions, needs solitary recharge, relies on structured plans."
                                    rows={10}
                                />
                            </div>
                            <div className={styles["field"]}>
                                <label htmlFor="persona-rules">Personality rules</label>
                                <textarea
                                    id="persona-rules"
                                    value={formState.persona_profile.personality_rules}
                                    onChange={handlePersonaFieldChange("personality_rules")}
                                    placeholder="Strategic, future-oriented, has high standards and boundaries, values long-term connections."
                                    rows={10}
                                />
                            </div>
                            <div className={styles["field"]}>
                                <label htmlFor="persona-tone">Tone</label>
                                <textarea
                                    id="persona-tone"
                                    value={formState.persona_profile.tone}
                                    onChange={handlePersonaFieldChange("tone")}
                                    placeholder="Direct and analytical with a hint of dry humor."
                                    rows={10}
                                />
                            </div>
                            <div className={styles["persona-grid"]}>
                                <div className={styles["field"]}>
                                    <label htmlFor="persona-likes">Likes (one per line)</label>
                                    <textarea
                                        id="persona-likes"
                                        value={formState.persona_profile.likes.join("\n")}
                                        onChange={handlePersonaListChange("likes")}
                                        placeholder="Daal Vaat&#10;Chinese food&#10;Water"
                                        rows={10}
                                    />
                                </div>
                                <div className={styles["field"]}>
                                    <label htmlFor="persona-dislikes">Dislikes (one per line)</label>
                                    <textarea
                                        id="persona-dislikes"
                                        value={formState.persona_profile.dislikes.join("\n")}
                                        onChange={handlePersonaListChange("dislikes")}
                                        placeholder="Cold drinks&#10;Rotten smells&#10;Liars"
                                        rows={10}
                                    />
                                </div>
                            </div>

                            <div className={styles["section-heading"]}>
                                <h3>Relationship stages</h3>
                                <p>Describe behaviors across stages to help generate tailored prompts.</p>
                            </div>
                            <div className={styles["field"]}>
                                <label htmlFor="relationship-stages">Relationship Stages</label>
                                <select
                                    id="relationship-stages"
                                    value={formState.persona_profile.mbti_architype}
                                    onChange={handlePersonaFieldChange("mbti_architype")}
                                >
                                    <option value="">Select type</option>
                                    {["ISTJ", "ISFJ", "INFJ", "INTJ", "ISTP", "ISFP", "INFP", "INTP", "ESTP", "ESFP", "ENFP", "ENTP", "ESTJ", "ESFJ", "ENFJ", "ENTJ"].map((type) => (
                                        <option key={type} value={type}>
                                            {type}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div className={styles["stage-grid"]}>
                                {(
                                    [
                                        ["hate", "Avoids interaction and stays quiet."],
                                        ["dislike", "Remains silent and distant."],
                                        ["strangers", "Observes quietly, initially reserved."],
                                        ["talking", "Engages in meaningful conversation but remains private."],
                                        ["flirting", "Shows interest through subtle actions."],
                                        ["dating", "Plans meticulously and shows affection through acts of service."],
                                        ["in_love", "Demonstrates deep care and commitment, prioritizes long-term connection."],
                                    ] as const
                                ).map(([key, example]) => (
                                    <div key={key} className={styles["field"]}>
                                        <label htmlFor={`persona-stage-${key}`}>{key.replace("_", " ").toUpperCase()}</label>
                                        <textarea
                                            id={`persona-stage-${key}`}
                                            value={formState.persona_profile.stages[key]}
                                            onChange={handlePersonaStageChange(key)}
                                            placeholder={example}
                                            rows={2}
                                        />
                                    </div>
                                ))}
                            </div>

                            <div>
                                <div className={styles["section-heading"]}>
                                    <h3>Knowledge documents</h3>
                                    <p>Upload PDFs, DOC/DOCX, or TXT to enrich this influencer.</p>
                                </div>
                                <div className={styles["knowledge-actions"]}>
                                    <button
                                        type="button"
                                        className={styles["upload-button"]}
                                        onClick={handleKnowledgeUploadClick}
                                        disabled={!selectedId || selectedId === "new" || knowledgeUploading}
                                    >
                                        {knowledgeUploading ? "Uploading…" : "Upload document"}
                                    </button>
                                    <input
                                        ref={knowledgeFileInputRef}
                                        className={styles["file-input"]}
                                        type="file"
                                        accept=".pdf,.doc,.docx,.txt"
                                        onChange={handleKnowledgeFileChange}
                                    />
                                    {knowledgeError && <span className={styles["upload-error"]}>{knowledgeError}</span>}
                                </div>
                                <div className={styles["knowledge-list"]}>
                                    {selectedId === "new" ? (
                                        <div className={styles["list-placeholder"]}>Save the influencer first to attach documents.</div>
                                    ) : knowledgeLoading ? (
                                        <div className={styles["list-placeholder"]}>Loading documents…</div>
                                    ) : knowledgeFiles.length === 0 ? (
                                        <div className={styles["list-placeholder"]}>No documents uploaded yet.</div>
                                    ) : (
                                        knowledgeFiles.map((file) => (
                                            <div key={file.id} className={styles["knowledge-item"]}>
                                                <div>
                                                    <div className={styles["knowledge-item__name"]}>{file.filename}</div>
                                                    <div className={styles["knowledge-item__meta"]}>
                                                        <span>{file.file_type.toUpperCase()}</span>
                                                        <span>•</span>
                                                        <span>{formatFileSize(file.file_size_bytes)}</span>
                                                        <span>•</span>
                                                        <span>Status: {file.status}</span>
                                                        {file.error_message && (
                                                            <>
                                                                <span>•</span>
                                                                <span className={styles["upload-error"]}>{file.error_message}</span>
                                                            </>
                                                        )}
                                                    </div>
                                                </div>
                                                <button
                                                    type="button"
                                                    className={styles["secondary-button"]}
                                                    onClick={() => handleKnowledgeDelete(file.id)}
                                                    disabled={knowledgeUploading}
                                                >
                                                    Delete
                                                </button>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>

                            <div className={styles["field"]}>
                                <label htmlFor="influencer-prompt">Prompt</label>
                                <textarea
                                    id="influencer-prompt"
                                    value={formState.prompt_template}
                                    onChange={handleFieldChange("prompt_template")}
                                    placeholder="System prompt or guidance used for this influencer"
                                    rows={20}
                                />
                                <div className={styles["form-footer"]}>
                                    {promptSaveState !== "idle" && (
                                        <span
                                            className={`${styles["save-status"]} ${promptSaveState === "success" ? styles["save-status--success"] : ""} ${promptSaveState === "error" ? styles["save-status--error"] : ""}`}
                                        >
                                            {promptSaveState === "success" && "Prompt saved"}
                                            {promptSaveState === "error" && (promptSaveError || "Failed to save prompt")}
                                            {promptSaveState === "saving" && "Saving prompt…"}
                                        </span>
                                    )}
                                    <button type="button" className={styles["primary-button"]} disabled={promptSaveState === "saving"} onClick={handlePromptTemplateSave}>
                                        {promptSaveState === "saving" ? "Saving…" : "Save prompt only"}
                                    </button>
                                </div>
                            </div>

                            {/* <div className={styles["field"]}>
                                <label htmlFor="influencer-voice-prompt">Voice prompt</label>
                                <textarea
                                    id="influencer-voice-prompt"
                                    value={formState.voice_prompt}
                                    onChange={handleFieldChange("voice_prompt")}
                                    placeholder="Describe the desired voice style, pacing, tone, etc."
                                    rows={20}
                                />
                                <div className={styles["form-footer"]}>
                                    {voicePromptSaveState !== "idle" && (
                                        <span
                                            className={`${styles["save-status"]} ${voicePromptSaveState === "success" ? styles["save-status--success"] : ""} ${voicePromptSaveState === "error" ? styles["save-status--error"] : ""}`}
                                        >
                                            {voicePromptSaveState === "success" && "Voice prompt saved"}
                                            {voicePromptSaveState === "error" && (voicePromptSaveError || "Failed to save voice prompt")}
                                            {voicePromptSaveState === "saving" && "Saving voice prompt…"}
                                        </span>
                                    )}
                                    <button type="button" className={styles["primary-button"]} disabled={voicePromptSaveState === "saving"} onClick={handleVoicePromptSave}>
                                        {voicePromptSaveState === "saving" ? "Saving…" : "Save voice prompt only"}
                                    </button>
                                </div>
                            </div> */}

                            <div className={styles["form-footer"]}>
                                {saveState !== "idle" && (
                                    <span
                                        className={`${styles["save-status"]} ${saveState === "success" ? styles["save-status--success"] : ""} ${saveState === "error" ? styles["save-status--error"] : ""}`}
                                    >
                                        {saveState === "success" && "Changes saved"}
                                        {saveState === "error" && (saveError || "Failed to save changes")}
                                        {saveState === "saving" && "Saving…"}
                                    </span>
                                )}
                                <button type="button" className={styles["secondary-button"]} onClick={handleReset}>
                                    Reset
                                </button>
                                <button type="submit" className={styles["primary-button"]} disabled={saveState === "saving"}>
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
                                    {uploadRecords.length} row{uploadRecords.length === 1 ? "" : "s"}
                                </p>
                            </div>
                            <button type="button" className={styles["upload-modal__close"]} onClick={closeUploadModal}>
                                Close
                            </button>
                        </div>
                        {uploadRecords.length === 0 ? (
                            <div className={styles["upload-modal__empty"]}>No data to preview yet.</div>
                        ) : (
                            <ul className={styles["upload-modal__list"]}>
                                {uploadRecords.map((record, index) => {
                                    const isExpanded = expandedRecords.has(index);
                                    const label = getRecordLabel(record, index);
                                    const entries = Object.entries(record);
                                    return (
                                        <li key={`${label}-${index}`} className={styles["upload-modal__item"]}>
                                            <button
                                                type="button"
                                                className={`${styles["upload-modal__toggle"]} ${isExpanded ? styles["upload-modal__toggle--expanded"] : ""}`}
                                                onClick={() => toggleRecordExpansion(index)}
                                                aria-expanded={isExpanded}
                                            >
                                                <span>{label}</span>
                                                <span className={styles["upload-modal__chevron"]}>{isExpanded ? "-" : "+"}</span>
                                            </button>
                                            {isExpanded && (
                                                <div className={styles["upload-modal__body"]}>
                                                    {entries.map(([key, value]) => {
                                                        const formattedValue = formatRecordValue(value);
                                                        const isMultiline = /\n/.test(formattedValue);
                                                        return (
                                                            <div key={key} className={styles["upload-modal__row"]}>
                                                                <span className={styles["upload-modal__key"]}>{formatRecordKey(key)}</span>
                                                                {isMultiline ? (
                                                                    <pre className={styles["upload-modal__value-pre"]}>{formattedValue}</pre>
                                                                ) : (
                                                                    <span className={styles["upload-modal__value"]}>{formattedValue}</span>
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
