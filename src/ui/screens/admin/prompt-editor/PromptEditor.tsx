import React, { ChangeEvent, useCallback, useEffect, useMemo, useState } from "react";
import styles from "./PromptEditor.module.css";
import SvgPack from "@/utils/SvgPack";
import { apiClient } from "@/api/apis";
import { SystemPromptService, SystemPromptListItem } from "@/api/services/SystemPromptService";

type PromptNode = {
    id: string;
    name: string;
    description: string;
    defaultPrompt: string;
    updatedAt: string;
};

const nowLabel = () => new Date().toLocaleString("en-US", { month: "short", day: "numeric" });

const systemPromptService = SystemPromptService(apiClient);

const DEFAULT_PROMPTS: Record<string, { name: string; description: string; defaultPrompt: string }> = {
    "general-prompt": {
        name: "Base System Prompt",
        description: "Global system instructions applied to every interaction unless overridden.",
        defaultPrompt: "You are a charming conversational AI for TeaseMe. Keep replies playful, concise, supportive, and ask thoughtful follow-ups.",
    },
    "general-voice-prompt": {
        name: "Global Audio Prompt",
        description: "Voice/call guidance layered on top of the base system prompt.",
        defaultPrompt: "Stay responsive to live context. Keep answers tight so users can interrupt easily. Confirm what you heard when audio is unclear.",
    },
    "fact-extractor-prompt": {
        name: "FactExtractor Prompt",
        description: "Fact extraction rules for grounding and summaries.",
        defaultPrompt: "Extract concise facts and attributes only. Avoid speculation; prefer verbatim, sourced details. Flag uncertainty explicitly.",
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
        updatedAt: nowLabel(),
    }));

const mapListItemToNode = (item: SystemPromptListItem): PromptNode => {
    const meta = DEFAULT_PROMPTS[item.key];
    return {
        id: item.key,
        name: meta?.name ?? item.key,
        description: item.description ?? meta?.description ?? "",
        defaultPrompt: meta?.defaultPrompt ?? "",
        updatedAt: formatUpdatedAt(item.updated_at),
    };
};

const PromptEditor: React.FC = () => {
    const seedNodes = useMemo(() => createSeedNodes(), []);
    const [nodes, setNodes] = useState<PromptNode[]>([]);
    const [selectedId, setSelectedId] = useState<string>("");
    const [listLoading, setListLoading] = useState(true);
    const [listError, setListError] = useState<string | null>(null);
    const [promptLoading, setPromptLoading] = useState(false);
    const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
    const [saveError, setSaveError] = useState<string | null>(null);
    const [fetchedKeys, setFetchedKeys] = useState<Set<string>>(() => new Set());

    const selectedNode = useMemo(
        () => nodes.find((node) => node.id === selectedId),
        [nodes, selectedId],
    );

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
            const mapped =
                items.length > 0
                    ? items.map(mapListItemToNode)
                    : seedNodes;
            setNodes(mapped);
            setSelectedId(mapped[0]?.id ?? "");
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
                setNodes((prev) =>
                    prev.map((node) =>
                        node.id === key
                            ? {
                                ...node,
                                defaultPrompt: detail.prompt ?? node.defaultPrompt,
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

    const handleSave = useCallback(async () => {
        if (!selectedNode) return;
        setSaveError(null);
        setSaveState("saving");
        try {
            const response = await systemPromptService.upsert(selectedNode.id, {
                prompt: selectedNode.defaultPrompt,
                description: selectedNode.description,
            });
            setNodes((prev) =>
                prev.map((node) =>
                    node.id === selectedNode.id
                        ? {
                            ...node,
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
    }, [selectedNode]);

    return (
        <div className={styles["prompt-editor"]}>
            <aside className={styles["node-rail"]}>
                <div className={styles["rail-header"]}>
                    <div className={styles["rail-title"]}>
                        <SvgPack.Chat />
                        <div>
                            <p className={styles["rail-eyebrow"]}>Prompt Nodes</p>
                            <h2 className={styles["rail-heading"]}>Library</h2>
                        </div>
                    </div>
                    <span className={styles["rail-caption"]}></span>
                </div>
                <div className={styles["node-list"]}>
                    {listLoading && nodes.length === 0 ? (
                        <div className={styles["list-placeholder"]}>Loading prompts…</div>
                    ) : (
                        nodes.map((node) => (
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
            </aside>

            <section className={styles["editor-pane"]}>
                {selectedNode ? (
                    <>
                        <header className={styles["editor-header"]}>
                            <div>
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
                                    disabled={listLoading || promptLoading || saveState === "saving"}
                                >
                                    {saveState === "saving" ? "Saving…" : saveState === "saved" ? "Saved" : "Save prompt"}
                                </button>
                            </div>
                        </header>

                        {(listError || saveError) && (
                            <div className={styles["error-text"]}>{saveError ?? listError}</div>
                        )}

                        <div className={styles["fields-grid"]}>
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
                        </div>

                        <div className={styles["preview-bar"]}>
                            <div className={styles["preview-chip"]}>
                                <span className={styles["preview-chip__label"]}>Characters</span>
                                <span className={styles["preview-chip__value"]}>{selectedNode.defaultPrompt.length}</span>
                            </div>
                            <div className={styles["preview-chip"]}>
                                <span className={styles["preview-chip__label"]}>Last touched</span>
                                <span className={styles["preview-chip__value"]}>{selectedNode.updatedAt}</span>
                            </div>
                        </div>
                    </>
                ) : (
                    <div className={styles["empty-state"]}>
                        <SvgPack.Chat />
                        <p>No node selected. Create or pick a node to start editing prompts.</p>
                    </div>
                )}
            </section>
        </div>
    );
};

export default PromptEditor;
