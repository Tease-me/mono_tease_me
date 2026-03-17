import React, { ChangeEvent, useEffect, useMemo, useState } from "react";
import { apiClient } from "@/api/apis";
import {
  AdminAdultCharacter,
  AdminAdultCharacterAssetsPayload,
  AdminAdultCharacterCreatePayload,
  AdminAdultCharacterPatchPayload,
  AdminServices,
} from "@/api/services/AdminServices";
import LottieAnimation from "@/ui/components/LottieAnimation";
import AdminLayout from "@/ui/screens/admin/AdminLayout";
import AdminTwoColumn from "@/ui/screens/admin/AdminTwoColumn";
import styles from "./AdminCharacters.module.css";

const admin = AdminServices(apiClient);

type CharacterDraft = {
  slug: string;
  name: string;
  prompt_template: string;
  description: string;
  short_description: string;
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
  default_artwork_key: character.default_artwork_key ?? "",
  lottie_text: character.lottie_text ?? "",
  is_active: character.is_active,
  display_order: String(character.display_order),
});

const toCreatePayload = (
  draft: CharacterDraft
): AdminAdultCharacterCreatePayload => ({
  slug: draft.slug.trim(),
  name: draft.name.trim(),
  prompt_template: draft.prompt_template.trim(),
  description: draft.description.trim() || null,
  short_description: draft.short_description.trim() || null,
  default_artwork_key: draft.default_artwork_key.trim() || null,
  lottie_text: draft.lottie_text.trim() || null,
  is_active: draft.is_active,
  display_order: Number(draft.display_order || 0),
});

const toPatchPayload = (
  draft: CharacterDraft
): AdminAdultCharacterPatchPayload => ({
  slug: draft.slug.trim(),
  name: draft.name.trim(),
  prompt_template: draft.prompt_template.trim(),
  description: draft.description.trim() || null,
  short_description: draft.short_description.trim() || null,
  default_artwork_key: draft.default_artwork_key.trim() || null,
  lottie_text: draft.lottie_text.trim() || null,
  is_active: draft.is_active,
  display_order: Number(draft.display_order || 0),
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
  const [lottieData, setLottieData] = useState<any | null>(null);
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

  useEffect(() => {
    let ignore = false;

    if (!selectedCharacter?.lottie_text_url) {
      setLottieData(null);
      setLottieError(null);
      setLoadingLottie(false);
      return;
    }

    const loadLottie = async () => {
      setLoadingLottie(true);
      setLottieError(null);
      setLottieData(null);
      try {
        const response = await fetch(selectedCharacter.lottie_text_url as string);
        if (!response.ok) {
          throw new Error("Failed to load lottie preview.");
        }
        const data = await response.json();
        if (!ignore) {
          setLottieData(data);
        }
      } catch (e: any) {
        if (!ignore) {
          setLottieError(e?.message || "Failed to load lottie preview.");
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
  }, [selectedCharacter?.id, selectedCharacter?.lottie_text_url]);

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

  const handleAssetFileChange =
    (field: keyof AdminAdultCharacterAssetsPayload) =>
    (event: ChangeEvent<HTMLInputElement>) => {
      const nextFile = event.target.files?.[0] ?? null;
      setAssetFiles((prev) => ({ ...prev, [field]: nextFile }));
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
        const updated = await admin.updateAdultCharacter(
          selectedCharacter.id,
          toPatchPayload(draft)
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
      await loadCharacters(updated.id);
      setSuccessMsg("Character assets updated.");
    } catch (e: any) {
      setError(getErrorMessage(e, "Asset upload failed."));
    } finally {
      setUploadingAssets(false);
    }
  };

  const sidebar = (
    <aside className={styles["sidebar"]}>
      <div className={styles["sidebar-header"]}>
        <div>
          <div className={styles["sidebar-title"]}>Adult Characters</div>
          <div className={styles["sidebar-meta"]}>
            {loadingList ? "Loading..." : `${characters.length} loaded`}
          </div>
        </div>
      </div>
      <div className={styles["sidebar-actions"]}>
        <button
          type="button"
          className={styles["primary"]}
          onClick={handleCreateNew}
        >
          New character
        </button>
      </div>
      <div className={styles["sidebar-list"]}>
        {loadingList && <div className={styles["sidebar-empty"]}>Loading...</div>}
        {!loadingList && listError && (
          <div className={styles["sidebar-empty"]}>{listError}</div>
        )}
        {!loadingList && !listError && characters.length === 0 && (
          <div className={styles["sidebar-empty"]}>
            No adult characters found. Start by creating the first one.
          </div>
        )}
        {characters.map((character) => (
          <button
            key={character.id}
            type="button"
            className={`${styles["sidebar-item"]} ${
              selectedId === character.id ? styles["sidebar-item--active"] : ""
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
      <AdminTwoColumn sidebar={sidebar}>
        <section className={styles["main"]}>
          <div className={styles["panel-header"]}>
            <div>
              <div className={styles["panel-title"]}>
                {isCreateMode ? "Create character" : selectedCharacter?.name ?? "Character editor"}
              </div>
              {!isCreateMode && selectedCharacter && (
                <div className={styles["meta"]}>
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
              <div className={styles["pill-row"]}>
                <span
                  className={
                    selectedCharacter.is_active
                      ? styles["pill-active"]
                      : styles["pill-inactive"]
                  }
                >
                  {selectedCharacter.is_active ? "Active globally" : "Inactive globally"}
                </span>
              </div>
            )}
          </div>

          {listError && characters.length === 0 ? (
            <div className={`${styles["banner"]} ${styles["banner--error"]}`}>
              {listError}
            </div>
          ) : null}

          {successMsg && (
            <div className={`${styles["message"]} ${styles["message--success"]}`}>
              {successMsg}
            </div>
          )}

          {error && (
            <div className={`${styles["message"]} ${styles["message--error"]}`}>
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
                    <div className={styles["asset-card"]}>
                      <div className={styles["asset-card-header"]}>
                        <span>Default Artwork</span>
                        <span className={styles["asset-state"]}>
                          {selectedCharacter?.default_artwork_url ? "Ready" : "Missing"}
                        </span>
                      </div>
                      <div className={styles["asset-preview"]}>
                        {selectedCharacter?.default_artwork_url ? (
                          <img
                            src={selectedCharacter.default_artwork_url}
                            alt={`${selectedCharacter.name} artwork`}
                            className={styles["asset-image"]}
                          />
                        ) : (
                          <div className={styles["asset-empty"]}>
                            No artwork uploaded yet.
                          </div>
                        )}
                      </div>
                      <input
                        className={styles["file-input"]}
                        type="file"
                        accept="image/*"
                        onChange={handleAssetFileChange("default_artwork")}
                        disabled={isCreateMode || isBusy}
                      />
                      <div className={styles["helper"]}>
                        Upload a base image used when no influencer-specific artwork exists.
                      </div>
                    </div>
                    <div className={styles["asset-card"]}>
                      <div className={styles["asset-card-header"]}>
                        <span>Lottie Text</span>
                        <span className={styles["asset-state"]}>
                          {selectedCharacter?.lottie_text_url ? "Ready" : "Missing"}
                        </span>
                      </div>
                      <div className={styles["asset-preview"]}>
                        {loadingLottie ? (
                          <div className={styles["asset-empty"]}>
                            Loading lottie preview...
                          </div>
                        ) : lottieData ? (
                          <div className={styles["asset-lottie"]}>
                            <LottieAnimation autoplay loop animationData={lottieData} />
                          </div>
                        ) : lottieError ? (
                          <div className={styles["asset-empty"]}>
                            {lottieError}
                          </div>
                        ) : (
                          <div className={styles["asset-empty"]}>
                            No lottie file uploaded yet.
                          </div>
                        )}
                      </div>
                      <input
                        className={styles["file-input"]}
                        type="file"
                        accept=".json,application/json"
                        onChange={handleAssetFileChange("lottie_text")}
                        disabled={isCreateMode || isBusy}
                      />
                      <div className={styles["helper"]}>
                        Upload the global lottie JSON for this character.
                      </div>
                    </div>
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
                    className={styles["textarea"]}
                    value={draft.description}
                    onChange={handleDraftChange("description")}
                    placeholder="Optional description for admins and catalog display."
                    disabled={isBusy}
                  />
                </div>
                <div className={`${styles["field"]} ${styles["field--wide"]}`}>
                  <label className={styles["label"]}>Prompt Template</label>
                  <textarea
                    className={styles["textarea"]}
                    value={draft.prompt_template}
                    onChange={handleDraftChange("prompt_template")}
                    placeholder="Base prompt for this character"
                    disabled={isBusy}
                  />
                  <div className={styles["helper"]}>
                    <code>slug</code>, <code>name</code>, and <code>prompt_template</code> are
                    treated as required by the editor.
                  </div>
                </div>
              </div>

              <div className={styles["button-row"]}>
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
              </div>

              {!isCreateMode && selectedCharacter && (
                <>
                  {!confirmDelete ? (
                    <div className={styles["button-row"]}>
                      <button
                        type="button"
                        className={styles["danger"]}
                        onClick={() => setConfirmDelete(true)}
                        disabled={isBusy}
                      >
                        Delete character
                      </button>
                    </div>
                  ) : (
                    <div className={styles["confirm-row"]}>
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
                    </div>
                  )}
                </>
              )}
            </div>
          ) : (
            <div className={styles["panel-placeholder"]}>Select a character to edit.</div>
          )}
        </section>
      </AdminTwoColumn>
    </AdminLayout>
  );
};

export default AdminCharacters;
