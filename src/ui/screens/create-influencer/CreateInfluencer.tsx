import React, { ChangeEvent, FormEvent, useEffect, useMemo, useRef, useState } from "react";
import styles from "./CreateInfluencer.module.css";
import SvgPack from "@/utils/SvgPack";
import { InfluencerDataModel } from "@/data/models/InfluencerDataModel";
import { InfluencerRepo } from "@/data/repositories/InfluencerRepo";

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
    joinedDate: string;
    notes: string;
    voice_id: string;
    prompt_template: string;
    elevenlabs_agent_id: string;
    voice_prompt: string;
    social_connections: SocialConnections;
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

const createDefaultFormState = (): InfluencerFormState => ({
    id: "",
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    avatarUrl: "",
    joinedDate: toDateInputValue(null),
    notes: "",
    voice_id: "",
    prompt_template: "",
    elevenlabs_agent_id: "",
    voice_prompt: "",
    social_connections: createDefaultSocialConnections(),
});


function splitName(fullName: string) {
    if (!fullName) {
        return { firstName: "", lastName: "" };
    }
    const parts = fullName.trim().split(" ");
    if (parts.length === 1) {
        return { firstName: parts[0], lastName: "" };
    }
    const [firstName, ...rest] = parts;
    return { firstName, lastName: rest.join(" ") };
}

function createFormStateFromInfluencer(influencer: InfluencerDataModel): InfluencerFormState {
    const { firstName, lastName } = splitName(influencer.name);
    const incomingSocial = influencer.social_connections ?? createDefaultSocialConnections();
    return {
        id: String(influencer.id),
        firstName,
        lastName,
        email: "",
        phone: "",
        avatarUrl: influencer.img,
        joinedDate: toDateInputValue(influencer.joinedDate),
        notes: "",
        voice_id: influencer.voice_id ?? "",
        prompt_template: influencer.prompt_template ?? "",
        elevenlabs_agent_id: influencer.elevenlabs_agent_id ?? "",
        voice_prompt: influencer.voice_prompt ?? "",
        social_connections: {
            instagram: incomingSocial.instagram ?? false,
            facebook: incomingSocial.facebook ?? false,
            onlyfans: incomingSocial.onlyfans ?? false,
            twitter: incomingSocial.twitter ?? false,
        },
    };
}

const CreateInfluencer: React.FC = () => {
    const [influencers, setInfluencers] = useState<InfluencerDataModel[]>([]);
    const [selectedId, setSelectedId] = useState<string | "new" | null>(null);
    const [formState, setFormState] = useState<InfluencerFormState>(() => createDefaultFormState());
    const [searchTerm, setSearchTerm] = useState("");
    const [csvFileName, setCsvFileName] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const dashboardRepo = useMemo(() => InfluencerRepo(), []);
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        let isMounted = true;
        (async () => {
            setIsLoading(true);
            try {
                const data = await dashboardRepo.getInfluencers();
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
    }, [dashboardRepo]);

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

    const handleFieldChange = (field: keyof InfluencerFormState) => (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { value } = event.target;
        setFormState((prev) => ({ ...prev, [field]: value }));
    };

    const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        const existing = selectedId !== "new" ? influencers.find((influencer) => influencer.id === selectedId) : undefined;
        const nameFromFields = `${formState.firstName} ${formState.lastName}`.trim();
        const normalizedNameForUsername = nameFromFields
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "_")
            .replace(/^_+|_+$/g, "");
        const username = existing?.username || normalizedNameForUsername || "new_influencer";
        const fullName = nameFromFields || existing?.name || "New Influencer";
        const base: InfluencerDataModel = {
            id: formState.id || existing?.id || Date.now().toString(),
            name: fullName,
            username,
            img: formState.avatarUrl || existing?.img || "",
            joinedDate: formState.joinedDate || existing?.joinedDate || new Date().toISOString().slice(0, 10),
            earnings: existing?.earnings ?? 0,
            isSelected: false,
            voice_id: formState.voice_id || existing?.voice_id || "",
            prompt_template: formState.prompt_template || existing?.prompt_template || "",
            elevenlabs_agent_id: formState.elevenlabs_agent_id || existing?.elevenlabs_agent_id || "",
            voice_prompt: formState.voice_prompt || existing?.voice_prompt || "",
            social_connections: { ...formState.social_connections },
        };

        setInfluencers((prev) => {
            const index = prev.findIndex((influencer) => influencer.id === base.id);
            if (index === -1) {
                return [base, ...prev];
            }
            const next = [...prev];
            next[index] = base;
            return next;
        });

        setSelectedId(base.id);
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

    const handleSocialToggle = (platform: keyof SocialConnections) => {
        setFormState((prev) => ({
            ...prev,
            socialConnections: {
                ...prev.social_connections,
                [platform]: !prev.social_connections[platform],
            },
        }));
    };

    const socialPlatformMeta: Array<{
        key: keyof SocialConnections;
        label: string;
        description: string;
    }> = [
            { key: "instagram", label: "Instagram", description: "Sync reels, DMs, and stories." },
            { key: "facebook", label: "Facebook", description: "Manage posts and Messenger." },
            { key: "onlyfans", label: "OnlyFans", description: "Mirror exclusive drops and chats." },
            { key: "twitter", label: "X / Twitter", description: "Reply to mentions and DMs." },
        ];

    const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            setCsvFileName(file.name);
        } else {
            setCsvFileName(null);
        }
    };

    return (
        <div className={styles["create-ai"]}>
            <div className={styles["create-ai__header"]}>
                <h1 className={styles["create-ai__title"]}>Influencer Manager</h1>
                {csvFileName && <span className={styles["upload-feedback"]}>Imported: {csvFileName}</span>}
            </div>

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
                                return (
                                    <button
                                        type="button"
                                        key={influencer.id}
                                        className={`${styles["influencer-item"]} ${isActive ? styles["influencer-item--active"] : ""}`}
                                        onClick={() => setSelectedId(influencer.id)}
                                    >
                                        <div className={styles["influencer-item__avatar"]}>
                                            {influencer.img ? (
                                                <img src={influencer.img} alt={influencer.name} />
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
                                {formState.avatarUrl ? (
                                    <img src={formState.avatarUrl} alt={`${formState.firstName} ${formState.lastName}`} />
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
                                    value={formState.joinedDate}
                                    onChange={handleFieldChange("joinedDate")}
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
                                <label htmlFor="influencer-agent-id">ElevenLabs Agent ID</label>
                                <input
                                    id="influencer-agent-id"
                                    value={formState.elevenlabs_agent_id}
                                    onChange={handleFieldChange("elevenlabs_agent_id")}
                                    placeholder="agent_abc"
                                />
                            </div>
                        </div>

                        <div>
                            <div className={styles["section-heading"]}>
                                <h3>Social media connectors</h3>
                                <p>Link first-party profiles so calls and messages stay in sync.</p>
                            </div>
                            <div className={styles["social-connectors"]}>
                                {socialPlatformMeta.map(({ key, label, description }) => {
                                    const connected = formState.social_connections[key];
                                    return (
                                        <div
                                            key={key}
                                            className={`${styles["social-card"]} ${connected ? styles["social-card--connected"] : ""}`}
                                        >
                                            <div>
                                                <span className={styles["social-card__label"]}>{label}</span>
                                                <p className={styles["social-card__description"]}>{description}</p>
                                            </div>
                                            <button
                                                type="button"
                                                className={`${styles["social-button"]} ${connected ? styles["social-button--connected"] : ""}`}
                                                onClick={() => handleSocialToggle(key)}
                                                aria-pressed={connected}
                                            >
                                                {connected ? "Connected" : "Connect"}
                                            </button>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        <div className={styles["field"]}>
                            <label htmlFor="influencer-prompt">Prompt</label>
                            <textarea
                                id="influencer-prompt"
                                value={formState.prompt_template}
                                onChange={handleFieldChange("prompt_template")}
                                placeholder="System prompt or guidance used for this influencer"
                                rows={3}
                            />
                        </div>

                        <div className={styles["field"]}>
                            <label htmlFor="influencer-voice-prompt">Voice prompt</label>
                            <textarea
                                id="influencer-voice-prompt"
                                value={formState.voice_prompt}
                                onChange={handleFieldChange("voice_prompt")}
                                placeholder="Describe the desired voice style, pacing, tone, etc."
                                rows={3}
                            />
                        </div>

                        <div className={styles["field"]}>
                            <label htmlFor="influencer-notes">Notes</label>
                            <textarea
                                id="influencer-notes"
                                value={formState.notes}
                                onChange={handleFieldChange("notes")}
                                placeholder="Add any context or internal notes"
                                rows={4}
                            />
                        </div>

                        <div className={styles["form-footer"]}>
                            <button type="button" className={styles["secondary-button"]} onClick={handleReset}>
                                Reset
                            </button>
                            <button type="submit" className={styles["primary-button"]}>
                                Save changes
                            </button>
                        </div>
                    </form>
                </section>
            </div>
        </div>
    );
};

export default CreateInfluencer;
