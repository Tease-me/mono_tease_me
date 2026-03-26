import React, { ChangeEvent, useEffect, useMemo, useState } from "react";
import { PlusIcon, TrashIcon, XMarkIcon } from "@heroicons/react/24/outline";
const DotLottieWC = "dotlottie-wc" as unknown as React.ComponentType<{ src?: string; speed?: string; mode?: string; loop?: boolean; autoplay?: boolean; width?: string }>;
import { apiClient } from "@/api/apis";
import {
  AdminAdultCharacter,
  AdminAdultCharacterAssetsPayload,
  AdminAdultCharacterCreatePayload,
  AdminAdultCharacterPatchPayload,
  AdminServices,
} from "@/api/services/AdminServices";
import LottieAnimation from "@/ui/components/LottieAnimation";
import MaximizableTextEditor from "@/ui/components/inputs/text-inputs/MaximizableTextEditor";
import AssetPreview from "@/ui/components/uploads/AssetPreview";
import FileDropzone from "@/ui/components/uploads/FileDropzone";
import AdminLayout from "@/ui/screens/admin/AdminLayout";
import AdminTwoColumn from "@/ui/screens/admin/AdminTwoColumn";
import chrome from "@/ui/screens/admin/shared/AdminChrome.module.css";
import styles from "./AdminCharacters.module.css";

const admin = AdminServices(apiClient);

type CharacterDraft = {
  slug: string;
  name: string;
  prompt_template: string;
  description: string;
  short_description: string;
  first_messages: string[];
  default_artwork_key: string;
  lottie_text: string;
  is_active: boolean;
  display_order: string;
};

const emptyDraft = (): CharacterDraft => ({
  slug: "",
  name: "",
  prompt_template: "",
  description: "",
  short_description: "",
  first_messages: [],
  default_artwork_key: "",
  lottie_text: "",
  is_active: true,
  display_order: "0",
});

const mapCharacterToDraft = (character: AdminAdultCharacter): CharacterDraft => ({
  slug: character.slug,
  name: character.name,
  prompt_template: character.prompt_template,
  description: character.description ?? "",
  short_description: character.short_description ?? "",
  first_messages: character.first_messages ?? [],
  default_artwork_key: character.default_artwork_key ?? "",
  lottie_text: character.lottie_text ?? "",
  is_active: character.is_active,
  display_order: String(character.display_order),
});

const normalizeFirstMessages = (values: string[]) => {
  const cleaned = values.map((value) => value.trim()).filter(Boolean);
  return cleaned.length ? cleaned : null;
};

const toCreatePayload = (
  draft: CharacterDraft
): AdminAdultCharacterCreatePayload => ({
  slug: draft.slug.trim(),
  name: draft.name.trim(),
  prompt_template: draft.prompt_template.trim(),
  description: draft.description.trim() || null,
  short_description: draft.short_description.trim() || null,
  first_messages: normalizeFirstMessages(draft.first_messages),
  default_artwork_key: draft.default_artwork_key.trim() || null,
  lottie_text: draft.lottie_text.trim() || null,
  is_active: draft.is_active,
  display_order: Number(draft.display_order || 0),
});

const toPatchPayload = (
  draft: CharacterDraft,
  character: AdminAdultCharacter
): AdminAdultCharacterPatchPayload => ({
  ...(draft.slug.trim() !== character.slug ? { slug: draft.slug.trim() } : {}),
  ...(draft.name.trim() !== character.name ? { name: draft.name.trim() } : {}),
  ...(draft.prompt_template.trim() !== character.prompt_template
    ? { prompt_template: draft.prompt_template.trim() }
    : {}),
  ...((draft.description.trim() || null) !== (character.description ?? null)
    ? { description: draft.description.trim() || null }
    : {}),
  ...((draft.short_description.trim() || null) !==
  (character.short_description ?? null)
    ? { short_description: draft.short_description.trim() || null }
    : {}),
  ...(JSON.stringify(normalizeFirstMessages(draft.first_messages)) !==
  JSON.stringify(character.first_messages ?? null)
    ? { first_messages: normalizeFirstMessages(draft.first_messages) }
    : {}),
  ...((draft.default_artwork_key.trim() || null) !==
  (character.default_artwork_key ?? null)
    ? { default_artwork_key: draft.default_artwork_key.trim() || null }
    : {}),
  ...((draft.lottie_text.trim() || null) !== (character.lottie_text ?? null)
    ? { lottie_text: draft.lottie_text.trim() || null }
    : {}),
  ...(draft.is_active !== character.is_active ? { is_active: draft.is_active } : {}),
  ...(Number(draft.display_order || 0) !== character.display_order
    ? { display_order: Number(draft.display_order || 0) }
    : {}),
});

const formatDate = (value?: string | null) => {
  if (!value) return null;
  try {
    return new Date(value).toLocaleString();
  } catch {
    return value;
  }
};

const getErrorMessage = (error: any, fallback: string) =>
  error?.response?.data?.detail || error?.message || fallback;

const getLottieAssetFormat = (url?: string | null): "json" | "lottie" | null => {
  if (!url) return null;
  try {
    const normalized = url.split("?")[0]?.toLowerCase() ?? "";
    if (normalized.endsWith(".lottie")) return "lottie";
    if (normalized.endsWith(".json")) return "json";
  } catch {
    return null;
  }
  return null;
};

const detectLottieFormatFromResponse = async (
  response: Response,
  urlHint: "json" | "lottie" | null
): Promise<{ format: "json" | "lottie"; jsonData?: any }> => {
  const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
  const buffer = await response.arrayBuffer();
  const bytes = new Uint8Array(buffer.slice(0, 8));

  if (bytes[0] === 0x50 && bytes[1] === 0x4b) {
    return { format: "lottie" };
  }

  const text = new TextDecoder("utf-8").decode(buffer);
  const trimmed = text.trim();
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    return {
      format: "json",
      jsonData: JSON.parse(text),
    };
  }

  if (
    contentType.includes("application/zip") ||
    contentType.includes("application/octet-stream") ||
    contentType.includes("application/x-zip") ||
    contentType.includes("application/x-zip-compressed") ||
    contentType.includes("application/vnd.lottie") ||
    urlHint === "lottie" ||
    trimmed.startsWith("PK")
  ) {
    return { format: "lottie" };
  }

  throw new Error("Failed to detect lottie preview format.");
};

const AdminCharacters: React.FC = () => {
  const [characters, setCharacters] = useState<AdminAdultCharacter[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [listError, setListError] = useState<string | null>(null);

  const [selectedId, setSelectedId] = useState<number | "new" | null>(null);
  const [draft, setDraft] = useState<CharacterDraft>(() => emptyDraft());
  const [saving, setSaving] = useState(false);
  const [uploadingAssets, setUploadingAssets] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [assetFiles, setAssetFiles] = useState<AdminAdultCharacterAssetsPayload>({});
  const [assetReplaceMode, setAssetReplaceMode] = useState<
    Partial<Record<keyof AdminAdultCharacterAssetsPayload, boolean>>
  >({});
  const [lottieData, setLottieData] = useState<any | null>(null);
  const [resolvedLottieFormat, setResolvedLottieFormat] = useState<"json" | "lottie" | null>(null);
  const [loadingLottie, setLoadingLottie] = useState(false);
  const [lottieError, setLottieError] = useState<string | null>(null);

  const loadCharacters = async (preferredSelection?: number | "new" | null) => {
    setLoadingList(true);
    setListError(null);
    try {
      const data = await admin.listAdultCharacters();
      setCharacters(data || []);

      if (preferredSelection === "new") {
        setSelectedId("new");
        return;
      }

      if (preferredSelection === null) {
        setSelectedId(data[0]?.id ?? null);
        return;
      }

      const nextSelected =
        (preferredSelection &&
          data.find((item) => item.id === preferredSelection)?.id) ||
        data[0]?.id ||
        null;
      setSelectedId(nextSelected);
    } catch (e: any) {
      setListError(getErrorMessage(e, "Failed to load adult characters."));
      setCharacters([]);
      setSelectedId(null);
    } finally {
      setLoadingList(false);
    }
  };

  useEffect(() => {
    loadCharacters();
  }, []);

  useEffect(() => {
    setConfirmDelete(false);
    setError(null);
    setSuccessMsg(null);
    setAssetFiles({});
    setAssetReplaceMode({});
    if (selectedId === "new") {
      setDraft(emptyDraft());
      return;
    }

    if (selectedId === null) {
      return;
    }

    const selected = characters.find((item) => item.id === selectedId);
    if (selected) {
      setDraft(mapCharacterToDraft(selected));
    }
  }, [characters, selectedId]);

  const selectedCharacter = useMemo(
    () =>
      typeof selectedId === "number"
        ? characters.find((item) => item.id === selectedId) ?? null
        : null,
    [characters, selectedId]
  );
  const selectedLottieFormat = useMemo(
    () => getLottieAssetFormat(selectedCharacter?.lottie_text_url ?? null),
    [selectedCharacter?.lottie_text_url]
  );

  useEffect(() => {
    let ignore = false;

    if (!selectedCharacter?.lottie_text_url || selectedLottieFormat !== "json") {
      setLottieData(null);
      setLottieError(null);
      setLoadingLottie(false);
      setResolvedLottieFormat(selectedLottieFormat);
      if (selectedLottieFormat === "lottie") {
        return;
      }
      if (!selectedCharacter?.lottie_text_url) {
        return;
      }
    }

    const loadLottie = async () => {
      setLoadingLottie(true);
      setLottieError(null);
      setLottieData(null);
      setResolvedLottieFormat(selectedLottieFormat);
      try {
        const response = await fetch(selectedCharacter.lottie_text_url as string);
        if (!response.ok) {
          throw new Error("Failed to load lottie preview.");
        }
        const detected = await detectLottieFormatFromResponse(response, selectedLottieFormat);
        if (!ignore) {
          setResolvedLottieFormat(detected.format);
          setLottieData(detected.format === "json" ? detected.jsonData ?? null : null);
        }
      } catch (e: any) {
        if (!ignore) {
          setLottieError(e?.message || "Failed to load lottie preview.");
          setResolvedLottieFormat(null);
        }
      } finally {
        if (!ignore) {
          setLoadingLottie(false);
        }
      }
    };

    loadLottie();

    return () => {
      ignore = true;
    };
  }, [selectedCharacter?.id, selectedCharacter?.lottie_text_url, selectedLottieFormat]);

  const isCreateMode = selectedId === "new";
  const isBusy = saving || deleting || uploadingAssets;

  const handleDraftChange =
    (field: keyof CharacterDraft) =>
    (
      event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
    ) => {
      const nextValue =
        event.target instanceof HTMLInputElement &&
        event.target.type === "checkbox"
          ? event.target.checked
          : event.target.value;
      setDraft((prev) => ({ ...prev, [field]: nextValue }));
    };

  const setAssetFile = (
    field: keyof AdminAdultCharacterAssetsPayload,
    nextFile: File | null
  ) => {
    setAssetFiles((prev) => ({ ...prev, [field]: nextFile }));
  };

  const openAssetReplaceMode = (field: keyof AdminAdultCharacterAssetsPayload) => {
    setAssetReplaceMode((prev) => ({ ...prev, [field]: true }));
  };

  const closeAssetReplaceMode = (
    field: keyof AdminAdultCharacterAssetsPayload
  ) => {
    setAssetFile(field, null);
    setAssetReplaceMode((prev) => ({ ...prev, [field]: false }));
  };

  const handleFirstMessageChange =
    (index: number) => (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      const nextValue = event.target.value;
      setDraft((prev) => ({
        ...prev,
        first_messages: prev.first_messages.map((value, currentIndex) =>
          currentIndex === index ? nextValue : value
        ),
      }));
    };

  const handleAddFirstMessage = () => {
    setDraft((prev) => ({
      ...prev,
      first_messages: [...prev.first_messages, ""],
    }));
  };

  const handleRemoveFirstMessage = (index: number) => {
    setDraft((prev) => ({
      ...prev,
      first_messages: prev.first_messages.filter((_, currentIndex) => currentIndex !== index),
    }));
  };

  const validateDraft = () => {
    if (!draft.slug.trim()) return "Slug is required.";
    if (!draft.name.trim()) return "Name is required.";
    if (!draft.prompt_template.trim()) return "Prompt template is required.";
    if (draft.display_order.trim() === "") return "Display order is required.";
    if (Number.isNaN(Number(draft.display_order))) {
      return "Display order must be a valid number.";
    }
    return null;
  };

  const handleCreateNew = () => {
    setSelectedId("new");
    setDraft(emptyDraft());
    setConfirmDelete(false);
    setError(null);
    setSuccessMsg(null);
  };

  const handleSave = async () => {
    const validationError = validateDraft();
    if (validationError) {
      setError(validationError);
      return;
    }

    setSaving(true);
    setError(null);
    setSuccessMsg(null);

    try {
      if (isCreateMode) {
        const created = await admin.createAdultCharacter(toCreatePayload(draft));
        await loadCharacters(created.id);
        setSuccessMsg("Character created.");
      } else if (selectedCharacter) {
        const patchPayload = toPatchPayload(draft, selectedCharacter);
        if (Object.keys(patchPayload).length === 0) {
          setSuccessMsg("No changes to save.");
          return;
        }
        const updated = await admin.updateAdultCharacter(
          selectedCharacter.id,
          patchPayload
        );
        await loadCharacters(updated.id);
        setSuccessMsg("Character updated.");
      }
    } catch (e: any) {
      setError(getErrorMessage(e, "Save failed."));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedCharacter) return;
    setDeleting(true);
    setError(null);
    setSuccessMsg(null);
    try {
      await admin.deleteAdultCharacter(selectedCharacter.id);
      const currentIndex = characters.findIndex((item) => item.id === selectedCharacter.id);
      const fallbackId =
        characters[currentIndex + 1]?.id ??
        characters[currentIndex - 1]?.id ??
        null;
      await loadCharacters(fallbackId);
      setSuccessMsg("Character deleted.");
    } catch (e: any) {
      setError(getErrorMessage(e, "Delete failed."));
    } finally {
      setDeleting(false);
      setConfirmDelete(false);
    }
  };

  const handleAssetUpload = async () => {
    if (!selectedCharacter) return;

    if (!assetFiles.default_artwork && !assetFiles.lottie_text) {
      setError("Select at least one asset file to upload.");
      return;
    }

    setUploadingAssets(true);
    setError(null);
    setSuccessMsg(null);
    try {
      const updated = await admin.uploadAdultCharacterAssets(
        selectedCharacter.id,
        assetFiles
      );
      setAssetFiles({});
      setAssetReplaceMode({});
      await loadCharacters(updated.id);
      setSuccessMsg("Character assets updated.");
    } catch (e: any) {
      setError(getErrorMessage(e, "Asset upload failed."));
    } finally {
      setUploadingAssets(false);
    }
  };

  const sidebar = (
    <aside className={chrome["sidebar"]}>
      <div className={chrome["sidebarHeader"]}>
        <div>
          <div className={chrome["sidebarTitle"]}>Adult Characters</div>
          <div className={chrome["sidebarMeta"]}>
            {loadingList ? "Loading..." : `${characters.length} loaded`}
          </div>
        </div>
      </div>
      <div className={chrome["sidebarActions"]}>
        <button
          type="button"
          className={styles["primary"]}
          onClick={handleCreateNew}
        >
          New character
        </button>
      </div>
      <div className={chrome["sidebarList"]}>
        {loadingList && <div className={chrome["sidebarEmpty"]}>Loading...</div>}
        {!loadingList && listError && (
          <div className={chrome["sidebarEmpty"]}>{listError}</div>
        )}
        {!loadingList && !listError && characters.length === 0 && (
          <div className={chrome["sidebarEmpty"]}>
            No adult characters found. Start by creating the first one.
          </div>
        )}
        {characters.map((character) => (
          <button
            key={character.id}
            type="button"
            className={`${chrome["sidebarItem"]} ${
              selectedId === character.id ? chrome["sidebarItemActive"] : ""
            }`}
            onClick={() => setSelectedId(character.id)}
          >
            <span className={styles["sidebar-item-title"]}>
              <span>{character.name}</span>
              <span
                className={
                  character.is_active
                    ? styles["pill-active"]
                    : styles["pill-inactive"]
                }
              >
                {character.is_active ? "Active" : "Inactive"}
              </span>
            </span>
            <span className={styles["sidebar-item-meta"]}>
              {character.slug} • order {character.display_order}
            </span>
            {(character.short_description || character.description) && (
              <span className={styles["sidebar-item-summary"]}>
                {character.short_description || character.description}
              </span>
            )}
          </button>
        ))}
      </div>
    </aside>
  );

  return (
    <AdminLayout
      title="Characters"
      subtitle="Manage the global adult character catalog used across the system."
    >
      <AdminTwoColumn sidebar={sidebar} mainScrollable={false}>
        <section className={styles["main"]}>
          <div className={chrome["panelHeader"]}>
            <div>
              <div className={chrome["panelTitle"]}>
                {isCreateMode ? "Create character" : selectedCharacter?.name ?? "Character editor"}
              </div>
              {!isCreateMode && selectedCharacter && (
                <div className={chrome["panelMeta"]}>
                  <span>ID {selectedCharacter.id}</span>
                  {selectedCharacter.created_at && (
                    <span>Created {formatDate(selectedCharacter.created_at)}</span>
                  )}
                  {selectedCharacter.updated_at && (
                    <span>Updated {formatDate(selectedCharacter.updated_at)}</span>
                  )}
                </div>
              )}
            </div>
            {!isCreateMode && selectedCharacter && (
              <div className={chrome["pillRow"]}>
                <span
                  className={
                    selectedCharacter.is_active
                      ? chrome["pillActive"]
                      : chrome["pillInactive"]
                  }
                >
                  {selectedCharacter.is_active ? "Active globally" : "Inactive globally"}
                </span>
              </div>
            )}
          </div>

          {listError && characters.length === 0 ? (
            <div className={`${chrome["message"]} ${chrome["messageError"]}`}>
              {listError}
            </div>
          ) : null}

          {successMsg && (
            <div className={`${chrome["message"]} ${chrome["messageSuccess"]}`}>
              {successMsg}
            </div>
          )}

          {error && (
            <div className={`${chrome["message"]} ${chrome["messageError"]}`}>
              {error}
            </div>
          )}

          {!loadingList && (isCreateMode || selectedCharacter || characters.length === 0) ? (
            <div className={styles["form-card"]}>
              <div className={styles["form-grid"]}>
                <div className={styles["field"]}>
                  <label className={styles["label"]}>Slug</label>
                  <input
                    className={styles["input"]}
                    value={draft.slug}
                    onChange={handleDraftChange("slug")}
                    placeholder="nurse"
                    disabled={isBusy}
                  />
                </div>
                <div className={styles["field"]}>
                  <label className={styles["label"]}>Name</label>
                  <input
                    className={styles["input"]}
                    value={draft.name}
                    onChange={handleDraftChange("name")}
                    placeholder="Horny Nurse"
                    disabled={isBusy}
                  />
                </div>
                <div className={styles["field"]}>
                  <label className={styles["label"]}>Display Order</label>
                  <input
                    className={styles["input"]}
                    type="number"
                    value={draft.display_order}
                    onChange={handleDraftChange("display_order")}
                    disabled={isBusy}
                  />
                </div>
                <div className={styles["field"]}>
                  <label className={styles["label"]}>Short Description</label>
                  <input
                    className={styles["input"]}
                    value={draft.short_description}
                    onChange={handleDraftChange("short_description")}
                    placeholder="Brief character description for compact UI"
                    disabled={isBusy}
                  />
                </div>
                <div className={styles["field"]}>
                  <label className={styles["label"]}>Global State</label>
                  <label className={styles["checkbox-row"]}>
                    <input
                      type="checkbox"
                      checked={draft.is_active}
                      onChange={handleDraftChange("is_active")}
                      disabled={isBusy}
                    />
                    Character is globally active
                  </label>
                </div>
                <div className={`${styles["field"]} ${styles["field--wide"]}`}>
                  <label className={styles["label"]}>Base Assets</label>
                  <div className={styles["assets-grid"]}>
                    {(() => {
                      const artworkUrl = selectedCharacter?.default_artwork_url ?? null;
                      const pendingArtwork = assetFiles.default_artwork ?? null;
                      const showArtworkDropzone =
                        Boolean(pendingArtwork) ||
                        Boolean(assetReplaceMode.default_artwork) ||
                        !artworkUrl;
                      return (
                        <div className={styles["asset-card"]}>
                          {!showArtworkDropzone && (
                            <AssetPreview
                              label="Default Artwork"
                              url={artworkUrl}
                              type="image"
                              frame="vertical"
                              emptyLabel="No artwork uploaded yet."
                              action={
                                <button
                                  type="button"
                                  className={styles["icon-button"]}
                                  onClick={() => openAssetReplaceMode("default_artwork")}
                                  disabled={isCreateMode || isBusy}
                                  aria-label="Replace default artwork"
                                  title="Replace default artwork"
                                >
                                  <XMarkIcon className={styles["icon"]} aria-hidden="true" />
                                </button>
                              }
                            />
                          )}
                          {showArtworkDropzone && (
                            <>
                              <div className={styles["asset-card-header"]}>
                                <span>Default Artwork</span>
                                {artworkUrl && (
                                  <button
                                    type="button"
                                    className={styles["ghost"]}
                                    onClick={() => closeAssetReplaceMode("default_artwork")}
                                    disabled={isCreateMode || isBusy}
                                  >
                                    Cancel
                                  </button>
                                )}
                              </div>
                              <FileDropzone
                                title="Upload Default Artwork"
                                description="Drag and drop the base artwork here, or browse to stage a replacement."
                                accept="image/*"
                                file={pendingArtwork}
                                onFileChange={(file) => setAssetFile("default_artwork", file)}
                                onFileRemove={() => setAssetFile("default_artwork", null)}
                                browseLabel="Browse"
                                disabled={isCreateMode || isBusy}
                                metaText="Accepted: image/*"
                              />
                            </>
                          )}
                          <div className={styles["helper"]}>
                            Upload a base image used when no influencer-specific artwork exists.
                          </div>
                        </div>
                      );
                    })()}
                    {(() => {
                      const lottieUrl = selectedCharacter?.lottie_text_url ?? null;
                      const pendingLottie = assetFiles.lottie_text ?? null;
                      const showLottieDropzone =
                        Boolean(pendingLottie) ||
                        Boolean(assetReplaceMode.lottie_text) ||
                        !lottieUrl;
                      return (
                        <div className={styles["asset-card"]}>
                          {!showLottieDropzone && (
                            <>
                              <div className={styles["asset-card-header"]}>
                                <span>Lottie Text</span>
                                <button
                                  type="button"
                                  className={styles["icon-button"]}
                                  onClick={() => openAssetReplaceMode("lottie_text")}
                                  disabled={isCreateMode || isBusy}
                                  aria-label="Replace lottie text"
                                  title="Replace lottie text"
                                >
                                  <XMarkIcon className={styles["icon"]} aria-hidden="true" />
                                </button>
                              </div>
                              <div className={styles["asset-preview"]}>
                                {loadingLottie ? (
                                  <div className={styles["asset-empty"]}>
                                    Loading lottie preview...
                                  </div>
                                ) : resolvedLottieFormat === "lottie" && lottieUrl ? (
                                  <div className={styles["asset-lottie"]}>
                                    <DotLottieWC src={lottieUrl} speed="1" mode="forward" loop autoplay width="100%" />
                                  </div>
                                ) : lottieData ? (
                                  <div className={styles["asset-lottie"]}>
                                    <LottieAnimation autoplay loop animationData={lottieData} />
                                  </div>
                                ) : lottieError ? (
                                  <div className={styles["asset-empty"]}>{lottieError}</div>
                                ) : (
                                  <div className={styles["asset-empty"]}>
                                    No lottie file uploaded yet.
                                  </div>
                                )}
                              </div>
                            </>
                          )}
                          {showLottieDropzone && (
                            <>
                              <div className={styles["asset-card-header"]}>
                                <span>Lottie Text</span>
                                {lottieUrl && (
                                  <button
                                    type="button"
                                    className={styles["ghost"]}
                                    onClick={() => closeAssetReplaceMode("lottie_text")}
                                    disabled={isCreateMode || isBusy}
                                  >
                                    Cancel
                                  </button>
                                )}
                              </div>
                              <FileDropzone
                                title="Upload Lottie Text"
                                description="Drag and drop the lottie file here, or browse to stage a replacement."
                                accept=".json,.lottie,application/json"
                                file={pendingLottie}
                                onFileChange={(file) => setAssetFile("lottie_text", file)}
                                onFileRemove={() => setAssetFile("lottie_text", null)}
                                browseLabel="Browse"
                                disabled={isCreateMode || isBusy}
                                metaText="Accepted: .json, .lottie, application/json"
                              />
                            </>
                          )}
                          <div className={styles["helper"]}>
                            Upload the global lottie asset for this character as `.json` or `.lottie`.
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                  <div className={styles["button-row"]}>
                    <button
                      type="button"
                  className={styles["ghost"]}
                  onClick={handleAssetUpload}
                  disabled={
                        isCreateMode ||
                        isBusy ||
                        (!assetFiles.default_artwork && !assetFiles.lottie_text)
                      }
                    >
                      {uploadingAssets ? "Uploading assets..." : "Upload selected assets"}
                    </button>
                    {isCreateMode && (
                      <span className={styles["helper"]}>
                        Create the character first before uploading base assets.
                      </span>
                    )}
                  </div>
                </div>
                <div className={`${styles["field"]} ${styles["field--wide"]}`}>
                  <label className={styles["label"]}>Description</label>
                  <textarea
                    className={`${styles["textarea"]} ${styles["textarea--compact"]}`}
                    value={draft.description}
                    onChange={handleDraftChange("description")}
                    placeholder="Optional description for admins and catalog display."
                    disabled={isBusy}
                  />
                </div>
                <div className={`${styles["field"]} ${styles["field--wide"]}`}>
                  <div className={styles["field-header"]}>
                    <label className={styles["label"]}>First Messages</label>
                    <button
                      type="button"
                      className={styles["icon-button"]}
                      onClick={handleAddFirstMessage}
                      disabled={isBusy}
                      aria-label="Add first message line"
                      title="Add first message line"
                    >
                      <PlusIcon className={styles["icon"]} aria-hidden="true" />
                    </button>
                  </div>
                  {draft.first_messages.length > 0 ? (
                    <div className={styles["message-list"]}>
                      {draft.first_messages.map((message, index) => (
                        <div key={index} className={styles["message-row"]}>
                          <input
                            className={styles["input"]}
                            value={message}
                            onChange={handleFirstMessageChange(index)}
                            placeholder="Suggested opening line"
                            disabled={isBusy}
                          />
                          <button
                            type="button"
                            className={`${styles["icon-button"]} ${styles["icon-button--danger"]}`}
                            onClick={() => handleRemoveFirstMessage(index)}
                            disabled={isBusy}
                            aria-label={`Remove first message line ${index + 1}`}
                            title="Remove first message line"
                          >
                            <TrashIcon className={styles["icon"]} aria-hidden="true" />
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className={styles["empty-inline"]}>
                      No opening-line suggestions yet.
                    </div>
                  )}
                  <div className={styles["helper"]}>
                    Add optional suggested opening lines for call or chat flows.
                  </div>
                </div>
                <div className={`${styles["field"]} ${styles["field--wide"]}`}>
                  <MaximizableTextEditor
                    label="Prompt Template"
                    value={draft.prompt_template}
                    onChange={handleDraftChange("prompt_template")}
                    placeholder="Base prompt for this character"
                    disabled={isBusy}
                    rows={10}
                    inlineExpandedRows={22}
                    modalTitle={`${draft.name.trim() || "Character"} Prompt Template`}
                    helperText="slug, name, and prompt_template are treated as required by the editor."
                  />
                </div>
              </div>

              <div className={styles["footer-actions"]}>
                <div className={styles["footer-actions-left"]}>
                  <button
                    type="button"
                    className={styles["ghost"]}
                    onClick={() =>
                      setDraft(selectedCharacter ? mapCharacterToDraft(selectedCharacter) : emptyDraft())
                    }
                    disabled={isBusy}
                  >
                    Reset form
                  </button>

                  {!isCreateMode && selectedCharacter && !confirmDelete && (
                    <button
                      type="button"
                      className={styles["danger"]}
                      onClick={() => setConfirmDelete(true)}
                      disabled={isBusy}
                    >
                      Delete character
                    </button>
                  )}

                  {!isCreateMode && selectedCharacter && confirmDelete && (
                    <>
                      <span className={styles["confirm-label"]}>
                        Delete <strong>{selectedCharacter.name}</strong>? This cannot be undone.
                      </span>
                      <button
                        type="button"
                        className={styles["danger"]}
                        onClick={handleDelete}
                        disabled={isBusy}
                      >
                        {deleting ? "Deleting..." : "Confirm delete"}
                      </button>
                      <button
                        type="button"
                        className={styles["ghost"]}
                        onClick={() => setConfirmDelete(false)}
                        disabled={isBusy}
                      >
                        Cancel
                      </button>
                    </>
                  )}
                </div>

                <div className={styles["footer-actions-right"]}>
                  <button
                    type="button"
                    className={styles["primary"]}
                    onClick={handleSave}
                    disabled={isBusy}
                  >
                    {saving
                      ? isCreateMode
                        ? "Creating..."
                        : "Saving..."
                      : isCreateMode
                      ? "Create character"
                      : "Save changes"}
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className={chrome["emptyState"]}>Select a character to edit.</div>
          )}
        </section>
      </AdminTwoColumn>
    </AdminLayout>
  );
};

export default AdminCharacters;
