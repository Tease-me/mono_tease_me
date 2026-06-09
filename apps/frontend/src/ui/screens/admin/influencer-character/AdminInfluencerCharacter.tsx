import React, { useCallback, useEffect, useMemo, useState } from "react";
import { apiClient } from "@/api/apis";
import { InfluencerDataModel } from "@/data/models/InfluencerDataModel";
import { AdminInfluencerRepo } from "@/data/repositories/AdminInfluencerRepo";
import {
  AdminInfluencerCharacterAssetsPayload,
  AdminServices,
  AudioSampleType,
  InfluencerCharacterAssetType,
} from "@/api/services/AdminServices";
import type { AdminInfluencerCharacter as AdminInfluencerCharacterRow } from "@/api/services/AdminServices";
import type { CharacterAudioSample, CharacterSamples } from "@/api/models/adultCharacters";
import AssetPreview, { AssetPreviewType } from "@/ui/components/uploads/AssetPreview";
import AdminLayout from "@/ui/screens/admin/AdminLayout";
import AdminTwoColumn from "@/ui/screens/admin/AdminTwoColumn";
import FileDropzone from "@/ui/components/uploads/FileDropzone";
import chrome from "@/ui/screens/admin/shared/AdminChrome.module.css";
import styles from "./AdminInfluencerCharacter.module.css";

const admin = AdminServices(apiClient);
const adminInfluencerRepo = AdminInfluencerRepo();

const parseSamples = (meta: Record<string, unknown> | null): CharacterSamples => {
  const raw = meta?.samples as { normal?: CharacterAudioSample[]; explicit?: CharacterAudioSample[] } | undefined;
  return { normal: raw?.normal ?? [], explicit: raw?.explicit ?? [] };
};

const UPLOAD_SLOTS: Array<{
  field: keyof AdminInfluencerCharacterAssetsPayload;
  label: string;
  hint: string;
  accept: string;
  previewKind: AssetPreviewType;
  previewUrlKey: keyof AdminInfluencerCharacterRow;
  emptyLabel: string;
  metaText: string;
}> = [
  {
    field: "photo",
    label: "Photo",
    hint: "Main character image.",
    accept: "image/*",
    previewKind: "image",
    previewUrlKey: "photo_url",
    emptyLabel: "No photo uploaded",
    metaText: "Accepted: image/*",
  },
  {
    field: "photo_2x",
    label: "Photo 2x",
    hint: "Retina image variant.",
    accept: "image/*",
    previewKind: "image",
    previewUrlKey: "photo_2x_url",
    emptyLabel: "No 2x photo uploaded",
    metaText: "Accepted: image/*",
  },
  {
    field: "video_mp4",
    label: "Video MP4",
    hint: "Primary video source.",
    accept: "video/mp4",
    previewKind: "video",
    previewUrlKey: "video_mp4_url",
    emptyLabel: "No MP4 video uploaded",
    metaText: "Accepted: video/mp4",
  },
  {
    field: "video_webm",
    label: "Video WEBM",
    hint: "Alternative video source.",
    accept: "video/webm",
    previewKind: "video",
    previewUrlKey: "video_webm_url",
    emptyLabel: "No WEBM video uploaded",
    metaText: "Accepted: video/webm",
  },
  {
    field: "video_preview_png",
    label: "Video Poster",
    hint: "Poster image for preview.",
    accept: "image/*",
    previewKind: "image",
    previewUrlKey: "video_preview_png_url",
    emptyLabel: "No video poster uploaded",
    metaText: "Accepted: image/*",
  },
];

const getErrorMessage = (error: any, fallback: string) =>
  error?.response?.data?.detail || error?.message || fallback;

const AdminInfluencerCharacter: React.FC = () => {
  const [influencers, setInfluencers] = useState<InfluencerDataModel[]>([]);
  const [selectedInfluencerId, setSelectedInfluencerId] = useState<string | null>(null);
  const [loadingInfluencers, setLoadingInfluencers] = useState(false);
  const [listError, setListError] = useState<string | null>(null);

  const [characters, setCharacters] = useState<AdminInfluencerCharacterRow[]>([]);
  const [loadingCharacters, setLoadingCharacters] = useState(false);
  const [characterError, setCharacterError] = useState<string | null>(null);
  const [pageMessage, setPageMessage] = useState<string | null>(null);
  const [expandedCharacterId, setExpandedCharacterId] = useState<number | null>(null);

  const [pendingUploads, setPendingUploads] = useState<
    Record<number, AdminInfluencerCharacterAssetsPayload>
  >({});
  const [assetReplaceMode, setAssetReplaceMode] = useState<
    Record<number, Partial<Record<keyof AdminInfluencerCharacterAssetsPayload, boolean>>>
  >({});
  const [busyUploads, setBusyUploads] = useState<Record<number, boolean>>({});
  const [busyDeletes, setBusyDeletes] = useState<Record<string, boolean>>({});

  // Sample management
  const [pendingSamples, setPendingSamples] = useState<
    Record<number, { normal: File | null; explicit: File | null }>
  >({});
  const [busySampleUploads, setBusySampleUploads] = useState<Record<string, boolean>>({});
  const [busySampleDeletes, setBusySampleDeletes] = useState<Record<string, boolean>>({});

  useEffect(() => {
    let active = true;
    setLoadingInfluencers(true);
    setListError(null);
    adminInfluencerRepo
      .getInfluencers()
      .then((data) => {
        if (!active) return;
        setInfluencers(data || []);
        setSelectedInfluencerId((data && data[0]?.id) || null);
      })
      .catch((e) => {
        if (!active) return;
        setListError(getErrorMessage(e, "Failed to load influencers."));
      })
      .finally(() => {
        if (!active) return;
        setLoadingInfluencers(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const loadCharacters = useCallback(async (influencerId: string) => {
    setLoadingCharacters(true);
    setCharacterError(null);
    setPageMessage(null);
    try {
      const data = await admin.listInfluencerAdultCharacters(influencerId);
      setCharacters(data || []);
      setPendingUploads({});
      setAssetReplaceMode({});
    } catch (e: any) {
      setCharacters([]);
      setCharacterError(
        getErrorMessage(e, "Failed to load influencer characters.")
      );
    } finally {
      setLoadingCharacters(false);
    }
  }, []);

  useEffect(() => {
    if (selectedInfluencerId) {
      setExpandedCharacterId(null);
      loadCharacters(selectedInfluencerId);
    } else {
      setCharacters([]);
      setExpandedCharacterId(null);
    }
  }, [selectedInfluencerId, loadCharacters]);

  const setPendingFile = useCallback(
    (
      characterId: number,
      field: keyof AdminInfluencerCharacterAssetsPayload,
      nextFile: File | null
    ) => {
      setPendingUploads((prev) => ({
        ...prev,
        [characterId]: {
          ...(prev[characterId] || {}),
          [field]: nextFile,
        },
      }));
    },
    []
  );

  const clearPendingFile = (
    characterId: number,
    field: keyof AdminInfluencerCharacterAssetsPayload
  ) => {
    setPendingUploads((prev) => {
      const nextCharacterUploads = { ...(prev[characterId] || {}), [field]: null };
      const hasAnyPending = Object.values(nextCharacterUploads).some(Boolean);
      if (!hasAnyPending) {
        const next = { ...prev };
        delete next[characterId];
        return next;
      }
      return {
        ...prev,
        [characterId]: nextCharacterUploads,
      };
    });
  };

  const openAssetReplaceMode = useCallback(
    (characterId: number, field: keyof AdminInfluencerCharacterAssetsPayload) => {
      setAssetReplaceMode((prev) => ({
        ...prev,
        [characterId]: {
          ...(prev[characterId] || {}),
          [field]: true,
        },
      }));
    },
    []
  );

  const closeAssetReplaceMode = useCallback(
    (
      characterId: number,
      field: keyof AdminInfluencerCharacterAssetsPayload
    ) => {
      clearPendingFile(characterId, field);
      setAssetReplaceMode((prev) => ({
        ...prev,
        [characterId]: {
          ...(prev[characterId] || {}),
          [field]: false,
        },
      }));
    },
    []
  );

  const hasPendingFiles = (payload?: AdminInfluencerCharacterAssetsPayload) =>
    Boolean(
      payload?.photo ||
        payload?.photo_2x ||
        payload?.video_mp4 ||
        payload?.video_webm ||
        payload?.video_preview_png
    );

  const handleUpload = async (characterId: number) => {
    if (!selectedInfluencerId) return;
    const payload = pendingUploads[characterId];
    if (!hasPendingFiles(payload)) {
      setPageMessage("Select at least one asset file before uploading.");
      return;
    }

    setBusyUploads((prev) => ({ ...prev, [characterId]: true }));
    setCharacterError(null);
    setPageMessage(null);
    try {
      await admin.uploadInfluencerCharacterAssets(
        selectedInfluencerId,
        characterId,
        payload
      );
      await loadCharacters(selectedInfluencerId);
      setExpandedCharacterId(characterId);
      setPageMessage("Influencer character assets updated.");
    } catch (e: any) {
      setCharacterError(getErrorMessage(e, "Asset upload failed."));
    } finally {
      setBusyUploads((prev) => ({ ...prev, [characterId]: false }));
    }
  };

  const handleDelete = async (
    characterId: number,
    assetType: InfluencerCharacterAssetType
  ) => {
    if (!selectedInfluencerId) return;
    const key = `${characterId}:${assetType}`;
    setBusyDeletes((prev) => ({ ...prev, [key]: true }));
    setCharacterError(null);
    setPageMessage(null);
    try {
      await admin.deleteInfluencerCharacterAsset(
        selectedInfluencerId,
        characterId,
        assetType
      );
      await loadCharacters(selectedInfluencerId);
      setExpandedCharacterId(characterId);
      setPageMessage("Influencer character assets updated.");
    } catch (e: any) {
      setCharacterError(getErrorMessage(e, "Asset delete failed."));
    } finally {
      setBusyDeletes((prev) => ({ ...prev, [key]: false }));
    }
  };

  const setPendingSampleFile = useCallback(
    (characterId: number, sampleType: AudioSampleType, file: File | null) => {
      setPendingSamples((prev) => ({
        ...prev,
        [characterId]: {
          ...(prev[characterId] ?? { normal: null, explicit: null }),
          [sampleType]: file,
        },
      }));
    },
    []
  );

  const handleSampleUpload = useCallback(
    async (characterId: number, sampleType: AudioSampleType) => {
      if (!selectedInfluencerId) return;
      const file = pendingSamples[characterId]?.[sampleType];
      if (!file) return;

      const key = `${characterId}:${sampleType}`;
      setBusySampleUploads((prev) => ({ ...prev, [key]: true }));
      setPageMessage(null);
      setCharacterError(null);
      try {
        await admin.uploadInfluencerCharacterSample(
          selectedInfluencerId,
          characterId,
          sampleType,
          file
        );
        await loadCharacters(selectedInfluencerId);
        setExpandedCharacterId(characterId);
        setPageMessage("Sample uploaded.");
        setPendingSampleFile(characterId, sampleType, null);
      } catch (e: any) {
        setCharacterError(getErrorMessage(e, "Sample upload failed."));
      } finally {
        setBusySampleUploads((prev) => ({ ...prev, [key]: false }));
      }
    },
    [loadCharacters, pendingSamples, selectedInfluencerId, setPendingSampleFile]
  );

  const handleSampleDelete = async (characterId: number, sampleType: AudioSampleType, s3Key: string) => {
    if (!selectedInfluencerId) return;
    const key = `${characterId}:${sampleType}:${s3Key}`;
    setBusySampleDeletes((prev) => ({ ...prev, [key]: true }));
    setPageMessage(null);
    setCharacterError(null);
    try {
      await admin.deleteInfluencerCharacterSample(selectedInfluencerId, characterId, sampleType, s3Key);
      await loadCharacters(selectedInfluencerId);
      setExpandedCharacterId(characterId);
      setPageMessage("Sample deleted.");
    } catch (e: any) {
      setCharacterError(getErrorMessage(e, "Sample delete failed."));
    } finally {
      setBusySampleDeletes((prev) => ({ ...prev, [key]: false }));
    }
  };

  const selectedInfluencer = useMemo(
    () => influencers.find((item) => item.id === selectedInfluencerId) ?? null,
    [influencers, selectedInfluencerId]
  );

  const sidebar = (
    <aside className={chrome["sidebar"]}>
      <div className={chrome["sidebarHeader"]}>
        <div>
          <div className={chrome["sidebarTitle"]}>Influencers</div>
          <div className={chrome["sidebarMeta"]}>
            {loadingInfluencers ? "Loading..." : `${influencers.length} loaded`}
          </div>
        </div>
      </div>
      <div className={chrome["sidebarList"]}>
        {loadingInfluencers && (
          <div className={chrome["sidebarEmpty"]}>Loading influencers...</div>
        )}
        {!loadingInfluencers && listError && (
          <div className={chrome["sidebarEmpty"]}>{listError}</div>
        )}
        {!loadingInfluencers && !listError && influencers.length === 0 && (
          <div className={chrome["sidebarEmpty"]}>No influencers found.</div>
        )}
        {influencers.map((item) => (
          <button
            key={item.id}
            type="button"
            className={`${chrome["sidebarItem"]} ${
              item.id === selectedInfluencerId ? chrome["sidebarItemActive"] : ""
            }`}
            onClick={() => setSelectedInfluencerId(item.id)}
          >
            {item.name || item.id}
          </button>
        ))}
      </div>
    </aside>
  );

  return (
    <AdminLayout
      title="Influencer Character"
      subtitle="Manage influencer-scoped adult character assets."
    >
      <AdminTwoColumn sidebar={sidebar}>
        <section className={chrome["main"]}>
          {!selectedInfluencerId && !loadingInfluencers && (
            <div className={chrome["emptyState"]}>
              Select an influencer to manage character assets.
            </div>
          )}

          {selectedInfluencerId && (
            <>
              <div className={chrome["panelHeader"]}>
                <div>
                  <div className={chrome["panelTitle"]}>
                    {selectedInfluencer?.name || selectedInfluencerId}
                  </div>
                  <div className={chrome["panelMeta"]}>
                    {loadingCharacters
                      ? "Loading character assets..."
                      : `${characters.length} character${characters.length === 1 ? "" : "s"}`}
                  </div>
                </div>
              </div>

              {pageMessage && (
                <div className={`${chrome["message"]} ${chrome["messageSuccess"]}`}>
                  {pageMessage}
                </div>
              )}
              {characterError && (
                <div className={`${chrome["message"]} ${chrome["messageError"]}`}>
                  {characterError}
                </div>
              )}

              {loadingCharacters && (
                <div className={chrome["emptyState"]}>Loading character assets...</div>
              )}

              {!loadingCharacters && characters.length === 0 && !characterError && (
                <div className={chrome["emptyState"]}>
                  No characters found for this influencer.
                </div>
              )}

              {!loadingCharacters && characters.length > 0 && (
                <div className={styles["card-list"]}>
                  {characters.map((character) => {
                    const pending = pendingUploads[character.id];
                    const uploadBusy = !!busyUploads[character.id];
                    const description =
                      character.short_description || character.description || "No description";
                    const isExpanded = expandedCharacterId === character.id;
                    const stagedFileCount = UPLOAD_SLOTS.filter(
                      ({ field }) => pending?.[field]
                    ).length;
                    const samples = parseSamples(character.meta_json);
                    const normalCount = samples.normal.length;
                    const explicitCount = samples.explicit.length;
                    return (
                      <article key={character.id} className={styles["card"]}>
                        <button
                          type="button"
                          className={styles["card-toggle"]}
                          onClick={() =>
                            setExpandedCharacterId((prev) =>
                              prev === character.id ? null : character.id
                            )
                          }
                        >
                          <div className={styles["card-header"]}>
                            <div>
                              <div className={styles["card-title-row"]}>
                                <h3 className={styles["card-title"]}>{character.name}</h3>
                              </div>
                              <div className={styles["card-meta"]}>
                                {character.slug} • order {character.display_order}
                              </div>
                              <div className={styles["card-summary"]}>{description}</div>
                            </div>
                            <span
                              className={styles["accordion-indicator"]}
                              aria-hidden="true"
                            >
                              {isExpanded ? "Hide" : "Edit"}
                            </span>
                          </div>
                          <div className={chrome["pillRow"]}>
                            <span className={character.has_photo ? chrome["pillActive"] : chrome["pillMuted"]}>
                              {character.has_photo ? "Photo ready" : "Photo missing"}
                            </span>
                            <span className={character.has_complete_video_set ? chrome["pillActive"] : chrome["pillMuted"]}>
                              {character.has_complete_video_set ? "Video ready" : "Video incomplete"}
                            </span>
                            <span className={normalCount > 0 ? chrome["pillActive"] : chrome["pillMuted"]}>
                              {normalCount > 0 ? `Normal audio: ${normalCount}` : "No normal audio"}
                            </span>
                            <span className={explicitCount > 0 ? chrome["pillActive"] : chrome["pillMuted"]}>
                              {explicitCount > 0 ? `Explicit audio: ${explicitCount}` : "No explicit audio"}
                            </span>
                          </div>
                        </button>

                        {isExpanded && (
                          <div className={styles["card-body"]}>
                            <div className={styles["upload-panel"]}>
                              <div className={styles["upload-panel-header"]}>
                                <div>
                                  <div className={styles["upload-panel-title"]}>
                                    Character Assets
                                  </div>
                                  <div className={styles["upload-panel-meta"]}>
                                    {stagedFileCount > 0
                                      ? `${stagedFileCount} file${stagedFileCount === 1 ? "" : "s"} ready to upload`
                                      : "Preview current media, then replace any subset of files before uploading."}
                                  </div>
                                </div>
                                <span
                                  className={
                                    stagedFileCount > 0 ? chrome["pillActive"] : chrome["pillMuted"]
                                  }
                                >
                                  {stagedFileCount > 0 ? "Ready" : "Waiting"}
                                </span>
                              </div>

                              <div className={styles["asset-slot-grid"]}>
                                {UPLOAD_SLOTS.map((slot) => {
                                  const selectedFile = pending?.[slot.field];
                                  const previewUrl = character[slot.previewUrlKey] as string | null;
                                  const deleteKey = `${character.id}:${slot.field}`;
                                  const isReplaceMode =
                                    Boolean(selectedFile) ||
                                    Boolean(assetReplaceMode[character.id]?.[slot.field]) ||
                                    !previewUrl;
                                  return (
                                    <div key={slot.field} className={styles["slot-card"]}>
                                      {previewUrl && !isReplaceMode && (
                                        <AssetPreview
                                          label={slot.label}
                                          url={previewUrl}
                                          type={slot.previewKind}
                                          frame="vertical"
                                          emptyLabel={slot.emptyLabel}
                                          action={
                                            <button
                                              type="button"
                                              className={styles["slot-toggle"]}
                                              onClick={() =>
                                                openAssetReplaceMode(character.id, slot.field)
                                              }
                                              disabled={uploadBusy}
                                              aria-label={`Replace ${slot.label}`}
                                            >
                                              <span className={styles["slot-toggle-x"]}>×</span>
                                            </button>
                                          }
                                        />
                                      )}

                                      {isReplaceMode && (
                                        <>
                                          <div className={styles["replace-header"]}>
                                            <div className={styles["asset-label"]}>
                                              {previewUrl ? `Replace ${slot.label}` : slot.label}
                                            </div>
                                            {previewUrl && (
                                              <button
                                                type="button"
                                                className={styles["replace-cancel"]}
                                                onClick={() =>
                                                  closeAssetReplaceMode(character.id, slot.field)
                                                }
                                                disabled={uploadBusy}
                                              >
                                                Cancel
                                              </button>
                                            )}
                                          </div>
                                          <FileDropzone
                                            title={`Upload ${slot.label}`}
                                            description={slot.hint}
                                            accept={slot.accept}
                                            file={selectedFile ?? null}
                                            onFileChange={(file) =>
                                              setPendingFile(character.id, slot.field, file)
                                            }
                                            onFileRemove={() =>
                                              clearPendingFile(character.id, slot.field)
                                            }
                                            browseLabel="Browse"
                                            disabled={uploadBusy}
                                            metaText={slot.metaText}
                                          />
                                        </>
                                      )}

                                      <div className={styles["slot-actions"]}>
                                        <button
                                          type="button"
                                          className={styles["ghost"]}
                                          onClick={() => handleDelete(character.id, slot.field)}
                                          disabled={!previewUrl || !!busyDeletes[deleteKey]}
                                        >
                                          {busyDeletes[deleteKey] ? "Deleting..." : `Delete ${slot.label}`}
                                        </button>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>

                              <div className={styles["delete-row"]}>
                                <button
                                  type="button"
                                  className={styles["ghost"]}
                                  onClick={() => handleDelete(character.id, "video")}
                                  disabled={
                                    (!character.video_mp4_url &&
                                      !character.video_webm_url &&
                                      !character.video_preview_png_url) ||
                                    !!busyDeletes[`${character.id}:video`]
                                  }
                                >
                                  {busyDeletes[`${character.id}:video`]
                                    ? "Deleting..."
                                    : "Delete video set"}
                                </button>
                              </div>

                              <div className={chrome["actionRow"]}>
                                <button
                                  type="button"
                                  className={styles["primary"]}
                                  onClick={() => handleUpload(character.id)}
                                  disabled={uploadBusy || !hasPendingFiles(pending)}
                                >
                                  {uploadBusy ? "Uploading..." : "Upload selected assets"}
                                </button>
                              </div>
                            </div>

                            <div className={styles["samples-panel"]}>
                              <div className={styles["upload-panel-header"]}>
                                <div className={styles["upload-panel-title"]}>Audio Samples</div>
                              </div>
                              <div className={styles["samples-grid"]}>
                                {(["normal", "explicit"] as AudioSampleType[]).map((sampleType) => {
                                  const list: CharacterAudioSample[] = samples[sampleType];
                                  const pendingFile = pendingSamples[character.id]?.[sampleType] ?? null;
                                  const uploadKey = `${character.id}:${sampleType}`;
                                  const uploadBusyForType = !!busySampleUploads[uploadKey];
                                  return (
                                    <div key={sampleType} className={styles["sample-type-box"]}>
                                      <div className={styles["asset-label"]}>{sampleType}</div>

                                      {list.length === 0 ? (
                                        <div className={styles["sample-empty"]}>No {sampleType} samples uploaded</div>
                                      ) : (
                                        <div className={styles["sample-list"]}>
                                          {list.map((sample) => {
                                            const deleteKey = `${character.id}:${sampleType}:${sample.s3_key}`;
                                            return (
                                            <div key={sample.s3_key} className={styles["sample-row"]}>
                                              <div className={styles["sample-row-top"]}>
                                                <div className={styles["sample-info"]}>
                                                  <span className={styles["sample-filename"]}>{sample.original_filename}</span>
                                                  <span className={styles["sample-date"]}>{sample.created_at.slice(0, 10)}</span>
                                                </div>
                                                <button
                                                  type="button"
                                                  className={styles["ghost"]}
                                                  onClick={() => handleSampleDelete(character.id, sampleType, sample.s3_key)}
                                                  disabled={!!busySampleDeletes[deleteKey]}
                                                >
                                                  {busySampleDeletes[deleteKey] ? "Deleting..." : "Delete"}
                                                </button>
                                              </div>
                                              {sample.url && (
                                                <audio controls className={styles["audio-player"]}>
                                                  <source
                                                    src={sample.url}
                                                    type={sample.content_type || undefined}
                                                  />
                                                </audio>
                                              )}
                                            </div>
                                            );
                                          })}
                                        </div>
                                      )}

                                      <div className={styles["upload-slot"]}>
                                        <div className={styles["upload-slot-copy"]}>
                                          <div className={styles["upload-hint"]}>mp3, mp4, wav, webm, ogg</div>
                                        </div>
                                        <div className={styles["upload-slot-dropzone"]}>
                                          <FileDropzone
                                            title={`Upload ${sampleType} sample`}
                                            description={`Drag and drop a ${sampleType} sample here, or browse to stage it.`}
                                            accept=".mp3,.mp4,.wav,.webm,.ogg"
                                            file={pendingFile}
                                            onFileChange={(file) =>
                                              setPendingSampleFile(character.id, sampleType, file)
                                            }
                                            onFileRemove={() =>
                                              setPendingSampleFile(character.id, sampleType, null)
                                            }
                                            browseLabel="Browse"
                                            disabled={uploadBusyForType}
                                            metaText="Accepted: .mp3, .mp4, .wav, .webm, .ogg"
                                          />
                                        </div>
                                        <div className={styles["upload-slot-actions"]}>
                                          <button
                                            type="button"
                                            className={styles["primary"]}
                                            onClick={() => handleSampleUpload(character.id, sampleType)}
                                            disabled={!pendingFile || uploadBusyForType}
                                          >
                                            {uploadBusyForType ? "Uploading..." : "Upload"}
                                          </button>
                                        </div>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          </div>
                        )}
                      </article>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </section>
      </AdminTwoColumn>
    </AdminLayout>
  );
};

export default AdminInfluencerCharacter;
