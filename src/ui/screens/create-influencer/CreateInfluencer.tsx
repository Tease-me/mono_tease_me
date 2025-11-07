import React, { ChangeEvent, FormEvent, useEffect, useMemo, useRef, useState } from "react";
import styles from "./CreateInfluencer.module.css";
import SvgPack from "@/utils/SvgPack";
import { DashboardRepo } from "@/mj-dashboard/data/repositories/DashboardRepo";
import { DashboardInfluencerModel } from "@/mj-dashboard/data/models/DashboardInfluencerModel";
import { AccountStatus, SubscriptionLevel } from "@/mj-dashboard/data/models/enums";

type InfluencerFormState = {
    id: string;
    firstName: string;
    lastName: string;
    username: string;
    email: string;
    phone: string;
    avatarUrl: string;
    joinedDate: string;
    status: AccountStatus | "";
    subscriptionLevel: SubscriptionLevel | "";
    notes: string;
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

const defaultFormState: InfluencerFormState = {
    id: "",
    firstName: "",
    lastName: "",
    username: "",
    email: "",
    phone: "",
    avatarUrl: "",
    joinedDate: toDateInputValue(null),
    status: "",
    subscriptionLevel: "",
    notes: "",
};

const accountStatusLabels: Record<AccountStatus, string> = {
    [AccountStatus.active]: "Active",
    [AccountStatus.black_list]: "Blacklisted",
    [AccountStatus.frozen]: "Frozen",
    [AccountStatus.suspended]: "Suspended",
    [AccountStatus.inactive]: "Inactive",
};

const subscriptionLevelLabels: Record<SubscriptionLevel, string> = {
    [SubscriptionLevel.basic]: "Basic",
    [SubscriptionLevel.premium]: "Premium",
    [SubscriptionLevel.ultimate]: "Ultimate",
};

const accountStatusClassMap: Record<AccountStatus, string> = {
    [AccountStatus.active]: "status-badge--active",
    [AccountStatus.black_list]: "status-badge--blacklist",
    [AccountStatus.frozen]: "status-badge--frozen",
    [AccountStatus.suspended]: "status-badge--suspended",
    [AccountStatus.inactive]: "status-badge--inactive",
};

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

function createFormStateFromInfluencer(influencer: DashboardInfluencerModel): InfluencerFormState {
    const { firstName, lastName } = splitName(influencer.fullName);
    return {
        id: String(influencer.id),
        firstName,
        lastName,
        username: influencer.username,
        email: "",
        phone: "",
        avatarUrl: influencer.imgUrl,
        joinedDate: toDateInputValue(influencer.joinedDate),
        status: influencer.accountStatus,
        subscriptionLevel: influencer.subscriptionLevel,
        notes: "",
    };
}

const CreateInfluencer: React.FC = () => {
    const [influencers, setInfluencers] = useState<DashboardInfluencerModel[]>([]);
    const [selectedId, setSelectedId] = useState<string | number | "new" | null>(null);
    const [formState, setFormState] = useState<InfluencerFormState>(defaultFormState);
    const [searchTerm, setSearchTerm] = useState("");
    const [csvFileName, setCsvFileName] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const dashboardRepo = useMemo(() => DashboardRepo(), []);
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        let isMounted = true;
        (async () => {
            setIsLoading(true);
            try {
                const data = await dashboardRepo.getAllInfluencers();
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
            setFormState({ ...defaultFormState, joinedDate: toDateInputValue(null) });
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
                influencer.fullName.toLowerCase().includes(normalized) ||
                influencer.username.toLowerCase().includes(normalized) ||
                String(influencer.id).toLowerCase().includes(normalized)
            );
        });
    }, [influencers, searchTerm]);

    const handleFieldChange = (field: keyof InfluencerFormState) => (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { value } = event.target;
        setFormState((prev) => ({ ...prev, [field]: value }));
    };

    const handleStatusChange = (event: ChangeEvent<HTMLSelectElement>) => {
        const value = event.target.value;
        setFormState((prev) => ({
            ...prev,
            status: value === "" ? "" : (Number(value) as AccountStatus),
        }));
    };

    const handleSubscriptionChange = (event: ChangeEvent<HTMLSelectElement>) => {
        const value = event.target.value;
        setFormState((prev) => ({
            ...prev,
            subscriptionLevel: value === "" ? "" : (Number(value) as SubscriptionLevel),
        }));
    };

    const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        const existing = selectedId !== "new" ? influencers.find((influencer) => influencer.id === selectedId) : undefined;
        const base: DashboardInfluencerModel = {
            id: formState.id || existing?.id || Date.now().toString(),
            fullName: `${formState.firstName} ${formState.lastName}`.trim() || formState.username || "New Influencer",
            username: formState.username || existing?.username || "new_influencer",
            imgUrl: formState.avatarUrl || existing?.imgUrl || "",
            joinedDate: formState.joinedDate || existing?.joinedDate || new Date().toISOString().slice(0, 10),
            earnings: existing?.earnings ?? 0,
            accountStatus: (formState.status === "" ? AccountStatus.active : formState.status) as AccountStatus,
            subscriptionLevel: (formState.subscriptionLevel === "" ? SubscriptionLevel.basic : formState.subscriptionLevel) as SubscriptionLevel,
            isSelected: false,
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
        setFormState({ ...defaultFormState, joinedDate: toDateInputValue(null) });
    };

    const handleReset = () => {
        if (selectedId === "new" || selectedId === null) {
            setFormState({ ...defaultFormState, joinedDate: toDateInputValue(null) });
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

    const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            setCsvFileName(file.name);
        } else {
            setCsvFileName(null);
        }
    };

    const statusBadge = (status: AccountStatus) => {
        const statusClassKey = accountStatusClassMap[status];
        const className = `${styles["status-badge"]} ${styles[statusClassKey]}`;
        return <span className={className}>{accountStatusLabels[status]}</span>;
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
                                const { firstName, lastName } = splitName(influencer.fullName);
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
                                            {influencer.imgUrl ? (
                                                <img src={influencer.imgUrl} alt={influencer.fullName} />
                                            ) : initials ? (
                                                <span>{initials}</span>
                                            ) : (
                                                <SvgPack.Profile />
                                            )}
                                        </div>
                                        <div className={styles["influencer-item__copy"]}>
                                            <span className={styles["influencer-name"]}>{influencer.fullName}</span>
                                            <span className={styles["influencer-username"]}>@{influencer.username}</span>
                                        </div>
                                        {statusBadge(influencer.accountStatus)}
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
                                <label htmlFor="influencer-username">Username</label>
                                <input
                                    id="influencer-username"
                                    value={formState.username}
                                    onChange={handleFieldChange("username")}
                                    placeholder="@username"
                                    required
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
                                <label htmlFor="influencer-status">Status</label>
                                <select
                                    id="influencer-status"
                                    value={formState.status === "" ? "" : Number(formState.status)}
                                    onChange={handleStatusChange}
                                >
                                    <option value="">Select status</option>
                                    {Object.values(AccountStatus)
                                        .filter((value) => typeof value === "number")
                                        .map((status) => (
                                            <option key={status} value={status as number}>
                                                {accountStatusLabels[status as AccountStatus]}
                                            </option>
                                        ))}
                                </select>
                            </div>

                            <div className={styles["field"]}>
                                <label htmlFor="influencer-tier">Subscription tier</label>
                                <select
                                    id="influencer-tier"
                                    value={formState.subscriptionLevel === "" ? "" : Number(formState.subscriptionLevel)}
                                    onChange={handleSubscriptionChange}
                                >
                                    <option value="">Select tier</option>
                                    {Object.values(SubscriptionLevel)
                                        .filter((value) => typeof value === "number")
                                        .map((tier) => (
                                            <option key={tier} value={tier as number}>
                                                {subscriptionLevelLabels[tier as SubscriptionLevel]}
                                            </option>
                                        ))}
                                </select>
                            </div>
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
