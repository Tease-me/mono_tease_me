import React, { ChangeEvent, useMemo, useState } from "react";
import styles from "./PromptEditor.module.css";
import SvgPack from "@/utils/SvgPack";

type PromptNode = {
    id: string;
    name: string;
    description: string;
    defaultPrompt: string;
    status: "draft" | "live";
    updatedAt: string;
};

const nowLabel = () => new Date().toLocaleString("en-US", { month: "short", day: "numeric" });

const createSeedNodes = (): PromptNode[] => [
    {
        id: "general-prompt",
        name: "Base System Prompt",
        description: "Global system instructions applied to every interaction unless overridden.",
        defaultPrompt: "You are a charming conversational AI for TeaseMe. Keep replies playful, concise, supportive, and ask thoughtful follow-ups.",
        status: "live",
        updatedAt: nowLabel(),
    },
    {
        id: "general-voice-prompt",
        name: "Global Audio Prompt",
        description: "Voice/call guidance layered on top of the base system prompt.",
        defaultPrompt: "Stay responsive to live context. Keep answers tight so users can interrupt easily. Confirm what you heard when audio is unclear.",
        status: "live",
        updatedAt: nowLabel(),
    },
    {
        id: "fact-extractor-prompt",
        name: "FactExtractor Prompt",
        description: "Fact extraction rules for grounding and summaries.",
        defaultPrompt: "Extract concise facts and attributes only. Avoid speculation; prefer verbatim, sourced details. Flag uncertainty explicitly.",
        status: "draft",
        updatedAt: nowLabel(),
    },
];

const PromptEditor: React.FC = () => {
    const seedNodes = useMemo(() => createSeedNodes(), []);
    const [nodes, setNodes] = useState<PromptNode[]>(seedNodes);
    const [selectedId, setSelectedId] = useState<string>(seedNodes[0]?.id ?? "");
    const [saveState, setSaveState] = useState<"idle" | "saved">("idle");

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

    const handleSave = () => {
        setSaveState("saved");
        setTimeout(() => setSaveState("idle"), 2000);
    };

    const handleStatusToggle = () => {
        if (!selectedNode) return;
        setNodes((prev) =>
            prev.map((node) =>
                node.id === selectedId
                    ? { ...node, status: node.status === "live" ? "draft" : "live", updatedAt: nowLabel() }
                    : node,
            ),
        );
        setSaveState("idle");
    };

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
                    {nodes.map((node) => (
                        <button
                            key={node.id}
                            type="button"
                            className={`${styles["node-card"]} ${selectedId === node.id ? styles["node-card--active"] : ""}`}
                            onClick={() => setSelectedId(node.id)}
                        >
                            <div className={styles["node-card__top"]}>
                                <span className={styles["node-name"]}>{node.name}</span>
                                <span className={`${styles["pill"]} ${node.status === "live" ? styles["pill--live"] : styles["pill--draft"]}`}>
                                    {node.status === "live" ? "Live" : "Draft"}
                                </span>
                            </div>
                            <p className={styles["node-desc"]}>{node.description}</p>
                            <div className={styles["node-meta"]}>
                                <span className={styles["meta-dot"]} />
                                <span className={styles["meta-label"]}>Updated</span>
                                <span className={styles["meta-value"]}>{node.updatedAt}</span>
                            </div>
                        </button>
                    ))}
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
                                <button type="button" className={styles["ghost-button"]} onClick={handleStatusToggle}>
                                    {selectedNode.status === "live" ? "Mark Draft" : "Publish"}
                                </button>
                                <button
                                    type="button"
                                    className={`${styles["primary-button"]} ${saveState === "saved" ? styles["primary-button--saved"] : ""}`}
                                    onClick={handleSave}
                                >
                                    {saveState === "saved" ? "Saved" : "Save prompts"}
                                </button>
                            </div>
                        </header>

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
                                    rows={8}
                                />
                            </div>
                        </div>

                        <div className={styles["preview-bar"]}>
                            <div className={styles["preview-chip"]}>
                                <span className={styles["preview-chip__label"]}>Characters</span>
                                <span className={styles["preview-chip__value"]}>{selectedNode.defaultPrompt.length}</span>
                            </div>
                            <div className={styles["preview-chip"]}>
                                <span className={styles["preview-chip__label"]}>Status</span>
                                <span className={styles["preview-chip__value"]}>{selectedNode.status === "live" ? "Ready to ship" : "In progress"}</span>
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
