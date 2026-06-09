import React, { ChangeEvent, useCallback, useEffect, useMemo, useState } from "react";
import AdminTwoColumn from "../AdminTwoColumn";
import styles from "./PromptEditor.module.css";
import SvgPack from "@/utils/SvgPack";
import { apiClient } from "@/api/apis";
import { SystemPromptService, SystemPromptListItem, SystemPromptType } from "@/api/services/SystemPromptService";
import TabsLayout, { TabItem } from "@/ui/components/tabs/TabsLayout";

type PromptNode = {
    id: string;
    name: string;
    description: string;
    defaultPrompt: string;
    type: SystemPromptType;
    updatedAt: string;
};

type PromptTabKey = SystemPromptType;
type TimeVibeRange = {
    start_hour: number;
    end_hour: number;
    vibes: string[];
};
type TimeVibeConfig = {
    ranges: TimeVibeRange[];
};

const TIME_VIBE_CONFIG_KEY = "TIME_VIBE_CONFIG_JSON";
const DEFAULT_TIME_VIBE_CONFIG: TimeVibeConfig = {
    ranges: [
        { start_hour: 0, end_hour: 5, vibes: ["late night hours", "quiet hours"] },
        { start_hour: 6, end_hour: 8, vibes: ["early morning", "fresh start"] },
        { start_hour: 9, end_hour: 11, vibes: ["morning energy", "productive focus"] },
        { start_hour: 12, end_hour: 14, vibes: ["midday", "active hours"] },
        { start_hour: 15, end_hour: 17, vibes: ["afternoon", "steady flow"] },
        { start_hour: 18, end_hour: 20, vibes: ["evening", "wind down"] },
        { start_hour: 21, end_hour: 23, vibes: ["late evening", "night vibes"] },
    ],
};

const nowLabel = () => new Date().toLocaleString("en-US", { month: "short", day: "numeric" });

const systemPromptService = SystemPromptService(apiClient);

const DEFAULT_PROMPTS: Record<string, { name: string; description: string; defaultPrompt: string; type: SystemPromptType }> = {
    "general-prompt": {
        name: "Base System Prompt",
        description: "Global system instructions applied to every interaction unless overridden.",
        defaultPrompt: "You are a charming conversational AI for TeaseMe. Keep replies playful, concise, supportive, and ask thoughtful follow-ups.",
        type: "normal",
    },
    "general-voice-prompt": {
        name: "Global Audio Prompt",
        description: "Voice/call guidance layered on top of the base system prompt.",
        defaultPrompt: "Stay responsive to live context. Keep answers tight so users can interrupt easily. Confirm what you heard when audio is unclear.",
        type: "normal",
    },
    "fact-extractor-prompt": {
        name: "FactExtractor Prompt",
        description: "Fact extraction rules for grounding and summaries.",
        defaultPrompt: "Extract concise facts and attributes only. Avoid speculation; prefer verbatim, sourced details. Flag uncertainty explicitly.",
        type: "others",
    },
    [TIME_VIBE_CONFIG_KEY]: {
        name: "Time Vibe Config JSON",
        description: "Admin-editable hour ranges and vibe labels used by get_time_context().",
        defaultPrompt: JSON.stringify(DEFAULT_TIME_VIBE_CONFIG),
        type: "others",
    },
};

const formatUpdatedAt = (value?: string) => {
    if (!value) return nowLabel();
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) {
        return parsed.toLocaleString("en-US", { month: "short", day: "numeric" });
    }
    return value;
};

const createSeedNodes = (): PromptNode[] =>
    Object.entries(DEFAULT_PROMPTS).map(([id, meta]) => ({
        id,
        name: meta.name,
        description: meta.description,
        defaultPrompt: meta.defaultPrompt,
        type: meta.type,
        updatedAt: nowLabel(),
    }));

const parseTimeVibeConfig = (rawPrompt: string): TimeVibeConfig => {
    try {
        const parsed = JSON.parse(rawPrompt) as TimeVibeConfig;
        if (!parsed || !Array.isArray(parsed.ranges)) return DEFAULT_TIME_VIBE_CONFIG;
        return {
            ranges: parsed.ranges.map((range) => ({
                start_hour: Number.isFinite(range.start_hour) ? Math.trunc(range.start_hour) : 0,
                end_hour: Number.isFinite(range.end_hour) ? Math.trunc(range.end_hour) : 0,
                vibes: Array.isArray(range.vibes)
                    ? range.vibes.map((v) => String(v).trim()).filter(Boolean)
                    : [],
            })),
        };
    } catch {
        return DEFAULT_TIME_VIBE_CONFIG;
    }
};

const validateTimeVibeConfig = (config: TimeVibeConfig): string[] => {
    const errors: string[] = [];
    if (!Array.isArray(config.ranges) || config.ranges.length === 0) {
        errors.push("At least one range is required.");
        return errors;
    }

    const coverage = Array.from({ length: 24 }, () => 0);
    config.ranges.forEach((range, idx) => {
        if (!Number.isInteger(range.start_hour) || range.start_hour < 0 || range.start_hour > 23) {
            errors.push(`Range ${idx + 1}: start hour must be an integer in 0..23.`);
        }
        if (!Number.isInteger(range.end_hour) || range.end_hour < 0 || range.end_hour > 23) {
            errors.push(`Range ${idx + 1}: end hour must be an integer in 0..23.`);
        }
        if (range.start_hour > range.end_hour) {
            errors.push(`Range ${idx + 1}: start hour cannot be greater than end hour.`);
        }
        if (!Array.isArray(range.vibes) || range.vibes.length === 0) {
            errors.push(`Range ${idx + 1}: add at least one vibe.`);
        }
        if (Array.isArray(range.vibes) && range.vibes.some((v) => !String(v).trim())) {
            errors.push(`Range ${idx + 1}: vibes cannot be empty.`);
        }
        if (Number.isInteger(range.start_hour) && Number.isInteger(range.end_hour) && range.start_hour <= range.end_hour) {
            for (let hour = range.start_hour; hour <= range.end_hour; hour += 1) {
                coverage[hour] += 1;
            }
        }
    });

    const uncovered = coverage
        .map((count, hour) => (count === 0 ? hour : -1))
        .filter((hour) => hour >= 0);
    const overlaps = coverage
        .map((count, hour) => (count > 1 ? hour : -1))
        .filter((hour) => hour >= 0);
    if (uncovered.length > 0) {
        errors.push(`Missing hour coverage: ${uncovered.join(", ")}.`);
    }
    if (overlaps.length > 0) {
        errors.push(`Overlapping hour coverage: ${overlaps.join(", ")}.`);
    }
    return errors;
};

const fmtHourLabel = (hour: number): string => `${String(hour).padStart(2, "0")}:00`;
const HOUR_OPTIONS = Array.from({ length: 24 }, (_, hour) => ({
    value: hour,
    label: fmtHourLabel(hour),
}));

const mapListItemToNode = (item: SystemPromptListItem): PromptNode => {
    const meta = DEFAULT_PROMPTS[item.key];
    return {
        id: item.key,
        name: item.name ?? meta?.name ?? "Unnamed Prompt",
        description: item.description ?? meta?.description ?? "",
        defaultPrompt: meta?.defaultPrompt ?? "",
        type: item.type ?? meta?.type ?? "others",
        updatedAt: formatUpdatedAt(item.updated_at),
    };
};

const PromptEditor: React.FC = () => {
    const seedNodes = useMemo(() => createSeedNodes(), []);
    const promptTabs = useMemo<TabItem[]>(
        () => [
            { id: 0, name: "Normal Mode", content: null },
            { id: 1, name: "Adult Mode", content: null },
            { id: 2, name: "Others", content: null },
            { id: 3, name: "Relationship", content: null },
        ],
        [],
    );
    const [nodes, setNodes] = useState<PromptNode[]>([]);
    const [selectedId, setSelectedId] = useState<string>("");
    const [listLoading, setListLoading] = useState(true);
    const [listError, setListError] = useState<string | null>(null);
    const [promptLoading, setPromptLoading] = useState(false);
    const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
    const [saveError, setSaveError] = useState<string | null>(null);
    const [fetchedKeys, setFetchedKeys] = useState<Set<string>>(() => new Set());
    const [activeTabId, setActiveTabId] = useState<number>(promptTabs[0]?.id ?? 0);
    const [activeStage, setActiveStage] = useState<string>("HATE");
    const [relationshipStagePrompts, setRelationshipStagePrompts] = useState<Record<string, string[]>>({});
    const [timeVibeConfig, setTimeVibeConfig] = useState<TimeVibeConfig | null>(null);
    const [timeVibeDrafts, setTimeVibeDrafts] = useState<Record<number, string>>({});


    const activeTab = useMemo(
        () => promptTabs.find((tab) => tab.id === activeTabId) ?? promptTabs[0],
        [activeTabId, promptTabs],
    );

    const activeTabKey: PromptTabKey = useMemo(() => {
        if (activeTab.id === 1) return "adult";
        if (activeTab.id === 2) return "others";
        if (activeTab.id === 3) return "relationship";
        return "normal";
    }, [activeTab.id]);

    const visibleNodes = useMemo(
        () => nodes.filter((node) => node.type === activeTabKey),
        [nodes, activeTabKey],
    );

    const selectedNode = useMemo(
        () => nodes.find((node) => node.id === selectedId),
        [nodes, selectedId],
    );

    const relationshipStages = useMemo(() => Object.keys(relationshipStagePrompts), [relationshipStagePrompts]);
    const showRelationshipStages = useMemo(
        () => selectedNode?.id === "BASE_SYSTEM",
        [selectedNode],
    );
    const timeVibePromptPreview = useMemo(() => {
        if (!timeVibeConfig) return selectedNode?.defaultPrompt ?? "";
        return JSON.stringify({ ranges: timeVibeConfig.ranges });
    }, [selectedNode, timeVibeConfig]);

    const activeStagePrompts = useMemo(
        () => relationshipStagePrompts[activeStage] ?? [],
        [activeStage, relationshipStagePrompts],
    );
    const showTimeVibeConfigEditor = useMemo(
        () => selectedNode?.id === TIME_VIBE_CONFIG_KEY,
        [selectedNode],
    );
    const timeVibeErrors = useMemo(() => {
        if (!showTimeVibeConfigEditor || !timeVibeConfig) return [];
        return validateTimeVibeConfig(timeVibeConfig);
    }, [showTimeVibeConfigEditor, timeVibeConfig]);
    const timeVibeRangeErrors = useMemo(
        () => timeVibeErrors.filter((error) => error.startsWith("Range ")),
        [timeVibeErrors],
    );
    const timeVibeCoverageErrors = useMemo(
        () => timeVibeErrors.filter((error) => !error.startsWith("Range ")),
        [timeVibeErrors],
    );
    const hasTimeVibeCoverageIssues = useMemo(
        () => timeVibeCoverageErrors.length > 0,
        [timeVibeCoverageErrors],
    );
    const timeVibeTotalVibes = useMemo(
        () => (timeVibeConfig?.ranges ?? []).reduce((sum, range) => sum + range.vibes.length, 0),
        [timeVibeConfig],
    );
    const disableSaveForTimeVibe = showTimeVibeConfigEditor && timeVibeErrors.length > 0;

    const handleFieldChange = (field: "defaultPrompt" | "name" | "description") => {
        return (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
            const value = event.target.value;
            setNodes((prev) =>
                prev.map((node) =>
                    node.id === selectedId
                        ? {
                            ...node,
                            [field]: value,
                            updatedAt: nowLabel(),
                        }
                        : node,
                ),
            );
            setSaveState("idle");
        };
    };

    const hydrateList = useCallback(async () => {
        setListLoading(true);
        setListError(null);
        try {
            const items = await systemPromptService.list();
            const mapped = items.length > 0 ? items.map(mapListItemToNode) : seedNodes;
            const existingKeys = new Set(mapped.map((node) => node.id));
            const merged = [
                ...mapped,
                ...seedNodes.filter((node) => !existingKeys.has(node.id)),
            ];
            setNodes(merged);
            setSelectedId(merged[0]?.id ?? "");
            setFetchedKeys(new Set());
        } catch (error) {
            console.error("Failed to load prompts", error);
            setListError("Unable to load prompts from the server. Showing defaults.");
            setNodes(seedNodes);
            setSelectedId(seedNodes[0]?.id ?? "");
            setFetchedKeys(new Set());
        } finally {
            setListLoading(false);
        }
    }, [seedNodes]);

    useEffect(() => {
        void hydrateList();
    }, [hydrateList]);

    const loadPromptText = useCallback(
        async (key: string) => {
            setPromptLoading(true);
            try {
                const detail = await systemPromptService.get(key);
                if (key === "BASE_SYSTEM") {
                    try {
                        const detail = await systemPromptService.get("RELATIONSHIP_STAGE_PROMPTS");
                        const parsed = JSON.parse(detail.prompt);
                        setRelationshipStagePrompts(parsed);
                        setActiveStage(Object.keys(parsed)[0] ?? "HATE");
                    } catch (e) {
                        console.error("Failed to parse relationship stage prompts", e);
                    }
                }
                setNodes((prev) =>
                    prev.map((node) =>
                        node.id === key
                            ? {
                                ...node,
                                defaultPrompt: detail.prompt ?? node.defaultPrompt,
                                name: detail.name ?? node.name,
                                type: detail.type ?? node.type,
                                description: detail.description ?? node.description,
                                updatedAt: formatUpdatedAt(detail.updated_at) ?? node.updatedAt,
                            }
                            : node,
                    ),
                );
                setFetchedKeys((prev) => {
                    const next = new Set(prev);
                    next.add(key);
                    return next;
                });
            } catch (error) {
                console.error("Failed to fetch prompt", error);
                setListError("Unable to load the selected prompt.");
            } finally {
                setPromptLoading(false);
            }
        },
        [],
    );

    useEffect(() => {
        if (!selectedId) return;
        if (fetchedKeys.has(selectedId)) return;
        void loadPromptText(selectedId);
    }, [fetchedKeys, loadPromptText, selectedId]);

    useEffect(() => {
        if (!showTimeVibeConfigEditor || !selectedNode) {
            setTimeVibeConfig(null);
            setTimeVibeDrafts({});
            return;
        }
        setTimeVibeConfig(parseTimeVibeConfig(selectedNode.defaultPrompt));
        setTimeVibeDrafts({});
    }, [selectedNode, showTimeVibeConfigEditor]);

    useEffect(() => {
        if (visibleNodes.length === 0) {
            if (selectedId !== "") {
                setSelectedId("");
            }
            return;
        }
        if (!visibleNodes.some((node) => node.id === selectedId)) {
            setSelectedId(visibleNodes[0].id);
        }
    }, [selectedId, visibleNodes]);

    const handleSave = useCallback(async () => {
        if (!selectedNode) return;
        setSaveError(null);
        setSaveState("saving");
        try {
            let promptToSave = selectedNode.defaultPrompt;
            if (selectedNode.id === TIME_VIBE_CONFIG_KEY) {
                const nextConfig = timeVibeConfig ?? DEFAULT_TIME_VIBE_CONFIG;
                const errors = timeVibeErrors;
                if (errors.length > 0) {
                    setSaveError(errors.join(" "));
                    setSaveState("error");
                    return;
                }
                promptToSave = JSON.stringify({
                    ranges: nextConfig.ranges.map((range) => ({
                        start_hour: Math.trunc(range.start_hour),
                        end_hour: Math.trunc(range.end_hour),
                        vibes: range.vibes.map((v) => v.trim()).filter(Boolean),
                    })),
                });
            }
            const response = await systemPromptService.upsert(selectedNode.id, {
                prompt: promptToSave,
                name: selectedNode.name,
                type: selectedNode.type,
                description: selectedNode.description,
            });
            setNodes((prev) =>
                prev.map((node) =>
                    node.id === selectedNode.id
                        ? {
                            ...node,
                            defaultPrompt: promptToSave,
                            description: response.description ?? node.description,
                            updatedAt: formatUpdatedAt(response.updated_at),
                        }
                        : node,
                ),
            );
            setFetchedKeys((prev) => {
                const next = new Set(prev);
                next.add(selectedNode.id);
                return next;
            });
            setSaveState("saved");
            setTimeout(() => setSaveState("idle"), 1800);
        } catch (error) {
            console.error("Failed to save prompt", error);
            setSaveError(error instanceof Error ? error.message : "Failed to save prompt");
            setSaveState("error");
        }
    }, [selectedNode, timeVibeConfig, timeVibeErrors]);

    const updateRangeHour = useCallback((rangeIndex: number, field: "start_hour" | "end_hour", value: number) => {
        setTimeVibeConfig((prev) => {
            if (!prev) return prev;
            const ranges = prev.ranges.map((range, idx) =>
                idx === rangeIndex ? { ...range, [field]: value } : range,
            );
            return { ranges };
        });
        setSaveState("idle");
    }, []);

    const addRange = useCallback(() => {
        setTimeVibeConfig((prev) => ({
            ranges: [...(prev?.ranges ?? []), { start_hour: 0, end_hour: 0, vibes: [] }],
        }));
        setSaveState("idle");
    }, []);

    const resetTimeVibeDefaults = useCallback(() => {
        setTimeVibeConfig(DEFAULT_TIME_VIBE_CONFIG);
        setTimeVibeDrafts({});
        setSaveState("idle");
    }, []);

    const removeRange = useCallback((rangeIndex: number) => {
        setTimeVibeConfig((prev) => {
            if (!prev || prev.ranges.length <= 1) return prev;
            return { ranges: prev.ranges.filter((_, idx) => idx !== rangeIndex) };
        });
        setTimeVibeDrafts((prev) => {
            const next: Record<number, string> = {};
            Object.entries(prev).forEach(([key, val]) => {
                const idx = Number(key);
                if (idx < rangeIndex) next[idx] = val;
                if (idx > rangeIndex) next[idx - 1] = val;
            });
            return next;
        });
        setSaveState("idle");
    }, []);

    const addVibeChip = useCallback((rangeIndex: number) => {
        const draft = (timeVibeDrafts[rangeIndex] ?? "").trim();
        if (!draft) return;
        const candidates = draft
            .split(",")
            .map((v) => v.trim().replace(/\s+/g, " "))
            .filter(Boolean);
        if (candidates.length === 0) return;
        setTimeVibeConfig((prev) => {
            if (!prev) return prev;
            const ranges = prev.ranges.map((range, idx) =>
                idx === rangeIndex
                    ? {
                        ...range,
                        vibes: [
                            ...range.vibes,
                            ...candidates.filter(
                                (candidate) =>
                                    !range.vibes.some(
                                        (existing) => existing.toLowerCase() === candidate.toLowerCase(),
                                    ),
                            ),
                        ],
                    }
                    : range,
            );
            return { ranges };
        });
        setTimeVibeDrafts((prev) => ({ ...prev, [rangeIndex]: "" }));
        setSaveState("idle");
    }, [timeVibeDrafts]);

    const removeVibeChip = useCallback((rangeIndex: number, vibeIndex: number) => {
        setTimeVibeConfig((prev) => {
            if (!prev) return prev;
            const ranges = prev.ranges.map((range, idx) =>
                idx === rangeIndex
                    ? { ...range, vibes: range.vibes.filter((_, vIdx) => vIdx !== vibeIndex) }
                    : range,
            );
            return { ranges };
        });
        setSaveState("idle");
    }, []);

    const handleRelationshipSave = useCallback(async () => {
        if (!selectedNode) return;
        if (selectedNode.id !== "BASE_SYSTEM")
            return;
        setSaveError(null);
        setSaveState("saving");
        try {
            await systemPromptService.upsert("RELATIONSHIP_STAGE_PROMPTS", {
                prompt: relationshipStagePrompts ? JSON.stringify(relationshipStagePrompts) : "",
            });
            setSaveState("saved");
            setTimeout(() => setSaveState("idle"), 1800);
        } catch (error) {
            console.error("Failed to save relationship prompts", error);
            setSaveError(error instanceof Error ? error.message : "Failed to save relationship prompts");
            setSaveState("error");
        }
    }, [relationshipStagePrompts, selectedNode]);

    return (
        <>
            <TabsLayout tabs={promptTabs} activeTab={activeTab} setActiveTab={(tab) => setActiveTabId(tab.id)} />
            <AdminTwoColumn sidebar={<aside className={styles["node-rail"]}>
                    <div className={styles["rail-header"]}>
                        <div className={styles["rail-title"]}>
                            <div className={styles["rail-heading"]}>Prompt Nodes</div>
                        </div>
                        <span className={styles["rail-caption"]}></span>
                    </div>
                    <div className={styles["node-list"]}>
                        {listLoading && nodes.length === 0 ? (
                            <div className={styles["list-placeholder"]}>Loading prompts…</div>
                        ) : visibleNodes.length === 0 ? (
                            <div className={styles["list-placeholder"]}>No prompts in this tab yet.</div>
                        ) : (
                            visibleNodes.map((node) => (
                                <button
                                    key={node.id}
                                    type="button"
                                    className={`${styles["node-card"]} ${selectedId === node.id ? styles["node-card--active"] : ""}`}
                                    onClick={() => setSelectedId(node.id)}
                                >
                                    <div className={styles["node-card__top"]}>
                                        <span className={styles["node-name"]}>{node.name}</span>
                                    </div>
                                    <p className={styles["node-desc"]}>{node.description}</p>
                                    <div className={styles["node-meta"]}>
                                        <span className={styles["meta-dot"]} />
                                        <span className={styles["meta-label"]}>Updated</span>
                                        <span className={styles["meta-value"]}>{node.updatedAt}</span>
                                    </div>
                                </button>
                            ))
                        )}
                    </div>
                </aside>}>
                <section className={styles["editor-pane"]}>
                    {selectedNode ? (
                        <>
                            <header className={styles["editor-header"]}>
                                <div className={styles["header-fields"]}>
                                    <input
                                        className={styles["title-input"]}
                                        value={selectedNode.name}
                                        onChange={handleFieldChange("name")}
                                        placeholder="Node name"
                                    />
                                    <input
                                        className={styles["subtitle-input"]}
                                        value={selectedNode.description}
                                        onChange={handleFieldChange("description")}
                                        placeholder="Where is this prompt used?"
                                    />
                                </div>
                                <div className={styles["header-actions"]}>
                                    <button
                                        type="button"
                                        className={`${styles["primary-button"]} ${saveState === "saved" ? styles["primary-button--saved"] : ""}`}
                                        onClick={handleSave}
                                        disabled={listLoading || promptLoading || saveState === "saving" || disableSaveForTimeVibe}
                                    >
                                        {saveState === "saving" ? "Saving…" : saveState === "saved" ? "Saved" : "Save prompt"}
                                    </button>
                                    {disableSaveForTimeVibe && (
                                        <span className={styles["save-hint"]}>Fix validation issues to save</span>
                                    )}
                                </div>
                            </header>

                            {(listError || saveError) && (
                                <div className={styles["error-text"]}>{saveError ?? listError}</div>
                            )}

                            <div className={styles["fields-grid"]}>
                                {showTimeVibeConfigEditor ? (
                                    <div className={styles["field-card"]}>
                                        <div className={styles["field-label-row"]}>
                                            <span className={styles["field-label"]}>Time Vibe Ranges</span>
                                            <span className={styles["field-helper"]}>Edit intervals and add vibe chips</span>
                                        </div>
                                        <div className={styles["time-vibe-toolbar"]}>
                                            <div className={styles["time-vibe-status"]}>
                                                <span className={`${styles["status-pill"]} ${timeVibeErrors.length === 0 ? styles["status-pill--ok"] : styles["status-pill--warn"]}`}>
                                                    {timeVibeErrors.length === 0 ? "Valid" : `${timeVibeErrors.length} issue${timeVibeErrors.length === 1 ? "" : "s"}`}
                                                </span>
                                                <span className={styles["time-vibe-meta"]}>
                                                    {(timeVibeConfig?.ranges.length ?? 0)} ranges · {timeVibeTotalVibes} vibes
                                                </span>
                                            </div>
                                            <div className={styles["time-vibe-actions"]}>
                                                <button type="button" className={styles["ghost-button"]} onClick={addRange}>
                                                    + Add Range
                                                </button>
                                                <button type="button" className={styles["ghost-button"]} onClick={resetTimeVibeDefaults}>
                                                    Reset Defaults
                                                </button>
                                            </div>
                                        </div>
                                        <div className={styles["time-vibe-coverage"]}>
                                            <span className={styles["time-vibe-coverage__label"]}>24h coverage</span>
                                            <span className={`${styles["time-vibe-coverage__value"]} ${hasTimeVibeCoverageIssues ? styles["time-vibe-coverage__value--warn"] : styles["time-vibe-coverage__value--ok"]}`}>
                                                {hasTimeVibeCoverageIssues ? "Missing/Overlapping hours" : "Complete"}
                                            </span>
                                        </div>
                                        {timeVibeErrors.length > 0 && (
                                            <div className={styles["time-vibe-errors"]}>
                                                {timeVibeRangeErrors.map((error) => (
                                                    <span key={error} className={styles["time-vibe-error-chip"]}>{error}</span>
                                                ))}
                                                {timeVibeCoverageErrors.map((error) => (
                                                    <span key={error} className={styles["time-vibe-error-chip"]}>{error}</span>
                                                ))}
                                            </div>
                                        )}
                                        <div className={styles["time-vibe-section-label"]}>Time Ranges</div>
                                        <div className={styles["time-vibe-list"]}>
                                            {(timeVibeConfig?.ranges ?? []).map((range, rangeIndex) => (
                                                <div key={`${rangeIndex}-${range.start_hour}-${range.end_hour}`} className={styles["time-vibe-row"]}>
                                                    <div className={styles["time-vibe-row-head"]}>
                                                        <span className={styles["time-vibe-row-title"]}>Range {rangeIndex + 1}</span>
                                                        <span className={styles["time-vibe-row-window"]}>
                                                            {fmtHourLabel(range.start_hour)} - {fmtHourLabel(range.end_hour)}
                                                        </span>
                                                    </div>
                                                    <div className={styles["time-vibe-hours"]}>
                                                        <label>Start</label>
                                                        <select
                                                            className={styles["time-vibe-input"]}
                                                            value={range.start_hour}
                                                            onChange={(event) =>
                                                                updateRangeHour(
                                                                    rangeIndex,
                                                                    "start_hour",
                                                                    Number(event.target.value),
                                                                )
                                                            }
                                                        >
                                                            {HOUR_OPTIONS.map((hour) => (
                                                                <option key={hour.value} value={hour.value}>
                                                                    {hour.label}
                                                                </option>
                                                            ))}
                                                        </select>
                                                        <label>End</label>
                                                        <select
                                                            className={styles["time-vibe-input"]}
                                                            value={range.end_hour}
                                                            onChange={(event) =>
                                                                updateRangeHour(
                                                                    rangeIndex,
                                                                    "end_hour",
                                                                    Number(event.target.value),
                                                                )
                                                            }
                                                        >
                                                            {HOUR_OPTIONS.map((hour) => (
                                                                <option key={hour.value} value={hour.value}>
                                                                    {hour.label}
                                                                </option>
                                                            ))}
                                                        </select>
                                                        <button
                                                            type="button"
                                                            className={styles["time-vibe-remove"]}
                                                            onClick={() => removeRange(rangeIndex)}
                                                            disabled={(timeVibeConfig?.ranges.length ?? 0) <= 1}
                                                        >
                                                            Remove
                                                        </button>
                                                    </div>
                                                    <div className={styles["time-vibe-section-label"]}>Vibes</div>
                                                    <div className={styles["chip-wrap"]}>
                                                        {range.vibes.map((vibe, vibeIndex) => (
                                                            <span key={`${rangeIndex}-${vibeIndex}-${vibe}`} className={styles["chip"]}>
                                                                <span>{vibe}</span>
                                                                <button
                                                                    type="button"
                                                                    className={styles["chip-remove"]}
                                                                    onClick={() => removeVibeChip(rangeIndex, vibeIndex)}
                                                                    title="Remove vibe"
                                                                >
                                                                    ×
                                                                </button>
                                                            </span>
                                                        ))}
                                                        {range.vibes.length === 0 && (
                                                            <span className={styles["time-vibe-empty"]}>No vibes yet</span>
                                                        )}
                                                        <input
                                                            className={styles["chip-input"]}
                                                            value={timeVibeDrafts[rangeIndex] ?? ""}
                                                            onChange={(event) =>
                                                                setTimeVibeDrafts((prev) => ({
                                                                    ...prev,
                                                                    [rangeIndex]: event.target.value,
                                                                }))
                                                            }
                                                            onKeyDown={(event) => {
                                                                if (event.key === "Enter" || event.key === ",") {
                                                                    event.preventDefault();
                                                                    addVibeChip(rangeIndex);
                                                                }
                                                            }}
                                                            placeholder="Add vibe"
                                                        />
                                                        <button
                                                            type="button"
                                                            className={styles["chip-add"]}
                                                            onClick={() => addVibeChip(rangeIndex)}
                                                        >
                                                            Add
                                                        </button>
                                                        <span className={styles["chip-helper"]}>Press Enter or comma to add</span>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ) : (
                                    <div className={styles["field-card"]}>
                                        <div className={styles["field-label-row"]}>
                                            <span className={styles["field-label"]}>Prompt</span>
                                            <span className={styles["field-helper"]}>Single text used for this node</span>
                                        </div>
                                        <textarea
                                            className={styles["textarea"]}
                                            value={selectedNode.defaultPrompt}
                                            onChange={handleFieldChange("defaultPrompt")}
                                            placeholder="Write the base prompt for this node..."
                                            rows={16}
                                        />
                                    </div>
                                )}
                            </div>

                            <div className={styles["preview-bar"]}>
                                <div className={styles["preview-chip"]}>
                                    <span className={styles["preview-chip__label"]}>Key</span>
                                    <span className={styles["preview-chip__value"]}>{selectedNode.id}</span>
                                </div>
                                <div className={styles["preview-chip"]}>
                                    <span className={styles["preview-chip__label"]}>Characters</span>
                                    <span className={styles["preview-chip__value"]}>{timeVibePromptPreview.length}</span>
                                </div>
                                <div className={styles["preview-chip"]}>
                                    <span className={styles["preview-chip__label"]}>Last touched</span>
                                    <span className={styles["preview-chip__value"]}>{selectedNode.updatedAt}</span>
                                </div>
                            </div>
                            {showRelationshipStages && (
                                <div className={styles["relationship-panel"]}>
                                    <div className={styles["relationship-header"]}>
                                        <div className={styles["relationship-title"]}>Relationship stages</div>
                                        <p className={styles["relationship-subtitle"]}>
                                            Select a stage to preview its behavior copy.
                                        </p>
                                    </div>
                                    <div className={styles["relationship-body"]}>
                                        <div className={styles["field"]}>
                                            <label htmlFor="relationship-stage-select">Relationship stage</label>
                                            <select
                                                id="relationship-stage-select"
                                                value={activeStage}
                                                onChange={(event) => setActiveStage(event.target.value)}
                                            >
                                                {relationshipStages.map((stage) => (
                                                    <option key={stage} value={stage}>
                                                        {stage}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                        <div className={styles["field"]}>
                                            <label htmlFor="relationship-stage-prompt">
                                                {`Prompt for ${activeStage}`}
                                            </label>
                                            <textarea
                                                id="relationship-stage-prompt"
                                                value={activeStagePrompts.join("\n")}
                                                rows={12}
                                                onChange={(event) => {
                                                    const lines = event.target.value.split("\n");
                                                    setRelationshipStagePrompts((prev) => ({
                                                        ...prev,
                                                        [activeStage]: lines,
                                                    }));
                                                }}
                                            />
                                            <div className={styles["relationship-hint"]}>
                                                Use one line per bullet.
                                            </div>
                                            <button
                                                type="button"
                                                className={`${styles["primary-button"]} ${styles["relationship-save"]} ${saveState === "saved" ? styles["primary-button--saved"] : ""}`}
                                                onClick={handleRelationshipSave}
                                                disabled={listLoading || promptLoading || saveState === "saving"}
                                            >
                                                {saveState === "saving" ? "Saving…" : saveState === "saved" ? "Saved" : "Save relationship prompts"}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </>
                    ) : (
                        <div className={styles["empty-state"]}>
                            <SvgPack.Chat />
                            <p>No node selected. Create or pick a node to start editing prompts.</p>
                        </div>
                    )}
                </section>
            </AdminTwoColumn>
        </>
    );
};

export default PromptEditor;
