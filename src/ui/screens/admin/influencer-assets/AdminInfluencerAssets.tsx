import React, { useEffect, useMemo, useState } from "react";
import { apiClient } from "@/api/apis";
import {
  AdminInfluencerLandingAssetsPayload,
  AdminInfluencerLandingAssetsResponse,
  AdminServices,
  AdminTelegramWelcomeAudioResponse,
} from "@/api/services/AdminServices";
import { InfluencerServices } from "@/api/services/InfluencerService";
import { InfluencerResponse } from "@/api/models/influencers";
import AssetPreview, {
  AssetPreviewFrame,
  AssetPreviewType,
} from "@/ui/components/uploads/AssetPreview";
import FileDropzone from "@/ui/components/uploads/FileDropzone";
import AdminLayout from "@/ui/screens/admin/AdminLayout";
import AdminTwoColumn from "@/ui/screens/admin/AdminTwoColumn";
import styles from "./AdminInfluencerAssets.module.css";

const admin = AdminServices(apiClient);
const influencerSvc = InfluencerServices(apiClient);

type LandingSlotConfig = {
  field: keyof AdminInfluencerLandingAssetsPayload;
  label: string;
  hint: string;
  accept: string;
  previewKind: AssetPreviewType;
  previewFrame: AssetPreviewFrame;
  responseUrlKey: keyof AdminInfluencerLandingAssetsResponse;
  responseContentTypeKey?: keyof AdminInfluencerLandingAssetsResponse;
  emptyLabel: string;
  metaText: string;
};

type LandingGroupConfig = {
  title: string;
  description: string;
  columns?: 2 | 3;
  slots: LandingSlotConfig[];
};

const LANDING_GROUPS: LandingGroupConfig[] = [
  {
    title: "Hero",
    description: "Upload the 1x and 2x hero artwork used on the landing page.",
    columns: 2,
    slots: [
      {
        field: "hero_png",
        label: "Hero PNG",
        hint: "Primary 1x hero artwork.",
        accept: "image/png,image/*",
        previewKind: "image",
        previewFrame: "vertical",
        responseUrlKey: "hero_png_url",
        emptyLabel: "No 1x hero uploaded",
        metaText: "PNG or image file, 1x variant",
      },
      {
        field: "hero_png_2x",
        label: "Hero PNG 2x",
        hint: "Retina 2x hero artwork.",
        accept: "image/png,image/*",
        previewKind: "image",
        previewFrame: "vertical",
        responseUrlKey: "hero_png_2x_url",
        emptyLabel: "No 2x hero uploaded",
        metaText: "PNG or image file, 2x variant",
      },
    ],
  },
  {
    title: "Signature",
    description: "Upload the 1x and 2x signature overlays used on landing surfaces.",
    columns: 2,
    slots: [
      {
        field: "signature_png",
        label: "Signature PNG",
        hint: "Primary 1x signature artwork.",
        accept: "image/png,image/*",
        previewKind: "image",
        previewFrame: "landscape",
        responseUrlKey: "signature_png_url",
        emptyLabel: "No 1x signature uploaded",
        metaText: "PNG or image file, 1x variant",
      },
      {
        field: "signature_png_2x",
        label: "Signature PNG 2x",
        hint: "Retina 2x signature artwork.",
        accept: "image/png,image/*",
        previewKind: "image",
        previewFrame: "landscape",
        responseUrlKey: "signature_png_2x_url",
        emptyLabel: "No 2x signature uploaded",
        metaText: "PNG or image file, 2x variant",
      },
    ],
  },
  {
    title: "Background Video 1",
    description: "Manage the first landing background video in both supported formats, plus its poster.",
    columns: 3,
    slots: [
      {
        field: "background_video_1_poster_jpg",
        label: "Video 1 Poster",
        hint: "Poster JPG shown before video playback.",
        accept: "image/jpeg,image/jpg,image/*",
        previewKind: "image",
        previewFrame: "square",
        responseUrlKey: "background_video_1_poster_jpg_url",
        emptyLabel: "No poster uploaded",
        metaText: "JPG poster image",
      },
      {
        field: "background_video_1_mp4",
        label: "Video 1 MP4",
        hint: "MP4 version for browser playback.",
        accept: "video/mp4,video/*",
        previewKind: "video",
        previewFrame: "square",
        responseUrlKey: "background_video_1_mp4_url",
        responseContentTypeKey: "background_video_1_mp4_content_type",
        emptyLabel: "No MP4 video uploaded",
        metaText: "MP4 file",
      },
      {
        field: "background_video_1_webm",
        label: "Video 1 WEBM",
        hint: "WEBM fallback for browser playback.",
        accept: "video/webm,video/*",
        previewKind: "video",
        previewFrame: "square",
        responseUrlKey: "background_video_1_webm_url",
        responseContentTypeKey: "background_video_1_webm_content_type",
        emptyLabel: "No WEBM video uploaded",
        metaText: "WEBM file",
      },
    ],
  },
  {
    title: "Background Video 2",
    description: "Manage the second landing background video in both supported formats, plus its poster.",
    columns: 3,
    slots: [
      {
        field: "background_video_2_poster_jpg",
        label: "Video 2 Poster",
        hint: "Poster JPG shown before video playback.",
        accept: "image/jpeg,image/jpg,image/*",
        previewKind: "image",
        previewFrame: "square",
        responseUrlKey: "background_video_2_poster_jpg_url",
        emptyLabel: "No poster uploaded",
        metaText: "JPG poster image",
      },
      {
        field: "background_video_2_mp4",
        label: "Video 2 MP4",
        hint: "MP4 version for browser playback.",
        accept: "video/mp4,video/*",
        previewKind: "video",
        previewFrame: "square",
        responseUrlKey: "background_video_2_mp4_url",
        responseContentTypeKey: "background_video_2_mp4_content_type",
        emptyLabel: "No MP4 video uploaded",
        metaText: "MP4 file",
      },
      {
        field: "background_video_2_webm",
        label: "Video 2 WEBM",
        hint: "WEBM fallback for browser playback.",
        accept: "video/webm,video/*",
        previewKind: "video",
        previewFrame: "square",
        responseUrlKey: "background_video_2_webm_url",
        responseContentTypeKey: "background_video_2_webm_content_type",
        emptyLabel: "No WEBM video uploaded",
        metaText: "WEBM file",
      },
    ],
  },
  {
    title: "Background Image 1",
    description: "Upload both image-density variants for background image slot 1.",
    columns: 2,
    slots: [
      {
        field: "background_image_1",
        label: "Image 1",
        hint: "Standard density artwork.",
        accept: "image/*",
        previewKind: "image",
        previewFrame: "square",
        responseUrlKey: "background_image_1_url",
        emptyLabel: "No 1x image uploaded",
        metaText: "Image file, 1x variant",
      },
      {
        field: "background_image_1_2x",
        label: "Image 1 2x",
        hint: "High density artwork.",
        accept: "image/*",
        previewKind: "image",
        previewFrame: "square",
        responseUrlKey: "background_image_1_2x_url",
        emptyLabel: "No 2x image uploaded",
        metaText: "Image file, 2x variant",
      },
    ],
  },
  {
    title: "Background Image 2",
    description: "Upload both image-density variants for background image slot 2.",
    columns: 2,
    slots: [
      {
        field: "background_image_2",
        label: "Image 2",
        hint: "Standard density artwork.",
        accept: "image/*",
        previewKind: "image",
        previewFrame: "square",
        responseUrlKey: "background_image_2_url",
        emptyLabel: "No 1x image uploaded",
        metaText: "Image file, 1x variant",
      },
      {
        field: "background_image_2_2x",
        label: "Image 2 2x",
        hint: "High density artwork.",
        accept: "image/*",
        previewKind: "image",
        previewFrame: "square",
        responseUrlKey: "background_image_2_2x_url",
        emptyLabel: "No 2x image uploaded",
        metaText: "Image file, 2x variant",
      },
    ],
  },
  {
    title: "Background Image 3",
    description: "Upload both image-density variants for background image slot 3.",
    columns: 2,
    slots: [
      {
        field: "background_image_3",
        label: "Image 3",
        hint: "Standard density artwork.",
        accept: "image/*",
        previewKind: "image",
        previewFrame: "square",
        responseUrlKey: "background_image_3_url",
        emptyLabel: "No 1x image uploaded",
        metaText: "Image file, 1x variant",
      },
      {
        field: "background_image_3_2x",
        label: "Image 3 2x",
        hint: "High density artwork.",
        accept: "image/*",
        previewKind: "image",
        previewFrame: "square",
        responseUrlKey: "background_image_3_2x_url",
        emptyLabel: "No 2x image uploaded",
        metaText: "Image file, 2x variant",
      },
    ],
  },
];

const LANDING_UPLOAD_FIELDS = LANDING_GROUPS.flatMap((group) =>
  group.slots.map((slot) => slot.field)
);

const getErrorMessage = (error: any, fallback: string) =>
  error?.response?.data?.detail || error?.message || fallback;

const formatDate = (value?: string | null) => {
  if (!value) return "Never";
  try {
    return new Date(value).toLocaleString();
  } catch {
    return value;
  }
};

const countPendingLandingFiles = (
  payload?: AdminInfluencerLandingAssetsPayload
) => LANDING_UPLOAD_FIELDS.filter((field) => payload?.[field]).length;

const hasPendingLandingFiles = (
  payload?: AdminInfluencerLandingAssetsPayload
) => countPendingLandingFiles(payload) > 0;

const AdminInfluencerAssets: React.FC = () => {
  const [influencers, setInfluencers] = useState<InfluencerResponse[]>([]);
  const [selectedInfluencerId, setSelectedInfluencerId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [loadingInfluencers, setLoadingInfluencers] = useState(false);
  const [listError, setListError] = useState<string | null>(null);

  const [landingAssets, setLandingAssets] =
    useState<AdminInfluencerLandingAssetsResponse | null>(null);
  const [loadingLandingAssets, setLoadingLandingAssets] = useState(false);
  const [landingError, setLandingError] = useState<string | null>(null);
  const [pendingLandingUploads, setPendingLandingUploads] =
    useState<AdminInfluencerLandingAssetsPayload>({});
  const [landingReplaceMode, setLandingReplaceMode] = useState<
    Partial<Record<keyof AdminInfluencerLandingAssetsPayload, boolean>>
  >({});
  const [uploadingLanding, setUploadingLanding] = useState(false);

  const [telegramAudio, setTelegramAudio] =
    useState<AdminTelegramWelcomeAudioResponse | null>(null);
  const [loadingTelegramAudio, setLoadingTelegramAudio] = useState(false);
  const [telegramAudioError, setTelegramAudioError] = useState<string | null>(null);
  const [telegramAudioMissing, setTelegramAudioMissing] = useState(false);
  const [pendingTelegramAudio, setPendingTelegramAudio] = useState<File | null>(null);
  const [telegramAudioReplaceMode, setTelegramAudioReplaceMode] = useState(false);
  const [uploadingTelegramAudio, setUploadingTelegramAudio] = useState(false);

  const [pageMessage, setPageMessage] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoadingInfluencers(true);
    setListError(null);
    influencerSvc
      .getInfluencers()
      .then((data) => {
        if (!active) return;
        setInfluencers(data || []);
        setSelectedInfluencerId((current) => {
          if (current && data.some((item) => item.id === current)) {
            return current;
          }
          return data[0]?.id ?? null;
        });
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

  useEffect(() => {
    if (!selectedInfluencerId) {
      setLandingAssets(null);
      setTelegramAudio(null);
      setTelegramAudioMissing(false);
      setPendingLandingUploads({});
      setLandingReplaceMode({});
      setPendingTelegramAudio(null);
      setTelegramAudioReplaceMode(false);
      return;
    }

    let active = true;

    setLoadingLandingAssets(true);
    setLandingError(null);
    admin
      .getInfluencerLandingAssets(selectedInfluencerId)
      .then((data) => {
        if (!active) return;
        setLandingAssets(data);
      })
      .catch((e) => {
        if (!active) return;
        setLandingAssets(null);
        setLandingError(getErrorMessage(e, "Failed to load landing assets."));
      })
      .finally(() => {
        if (!active) return;
        setLoadingLandingAssets(false);
      });

    setLoadingTelegramAudio(true);
    setTelegramAudioError(null);
    setTelegramAudioMissing(false);
    admin
      .getTelegramWelcomeAudio(selectedInfluencerId)
      .then((data) => {
        if (!active) return;
        setTelegramAudio(data);
      })
      .catch((e) => {
        if (!active) return;
        if (e?.response?.status === 404) {
          setTelegramAudio(null);
          setTelegramAudioMissing(true);
          return;
        }
        setTelegramAudio(null);
        setTelegramAudioError(
          getErrorMessage(e, "Failed to load telegram welcome audio.")
        );
      })
      .finally(() => {
        if (!active) return;
        setLoadingTelegramAudio(false);
      });

    return () => {
      active = false;
    };
  }, [selectedInfluencerId]);

  const filteredInfluencers = useMemo(() => {
    if (!searchTerm.trim()) return influencers;
    const normalized = searchTerm.trim().toLowerCase();
    return influencers.filter((item) => {
      return (
        item.display_name?.toLowerCase().includes(normalized) ||
        item.id.toLowerCase().includes(normalized)
      );
    });
  }, [influencers, searchTerm]);

  const selectedInfluencer = useMemo(
    () => influencers.find((item) => item.id === selectedInfluencerId) ?? null,
    [influencers, selectedInfluencerId]
  );

  const landingStagedCount = countPendingLandingFiles(pendingLandingUploads);

  const handleLandingFileChange = (
    field: keyof AdminInfluencerLandingAssetsPayload,
    file: File | null
  ) => {
    setPendingLandingUploads((prev) => {
      const next = { ...prev, [field]: file };
      if (!hasPendingLandingFiles(next)) return {};
      return next;
    });
  };

  const handleUploadLandingAssets = async () => {
    if (!selectedInfluencerId) return;
    if (!hasPendingLandingFiles(pendingLandingUploads)) {
      setLandingError("Select at least one landing asset file before uploading.");
      return;
    }

    setUploadingLanding(true);
    setLandingError(null);
    setPageMessage(null);
    try {
      const updated = await admin.uploadInfluencerLandingAssets(
        selectedInfluencerId,
        pendingLandingUploads
      );
      setLandingAssets(updated);
      setPendingLandingUploads({});
      setLandingReplaceMode({});
      setPageMessage("Landing assets updated.");
    } catch (e: any) {
      setLandingError(getErrorMessage(e, "Landing asset upload failed."));
    } finally {
      setUploadingLanding(false);
    }
  };

  const handleUploadTelegramAudio = async () => {
    if (!selectedInfluencerId) return;
    if (!pendingTelegramAudio) {
      setTelegramAudioError("Select an audio file before uploading.");
      return;
    }

    setUploadingTelegramAudio(true);
    setTelegramAudioError(null);
    setPageMessage(null);
    try {
      const updated = await admin.uploadTelegramWelcomeAudio(
        selectedInfluencerId,
        pendingTelegramAudio
      );
      setTelegramAudio(updated);
      setTelegramAudioMissing(false);
      setPendingTelegramAudio(null);
      setTelegramAudioReplaceMode(false);
      setPageMessage("Telegram welcome audio updated.");
    } catch (e: any) {
      setTelegramAudioError(getErrorMessage(e, "Telegram audio upload failed."));
    } finally {
      setUploadingTelegramAudio(false);
    }
  };

  const openLandingReplaceMode = (
    field: keyof AdminInfluencerLandingAssetsPayload
  ) => {
    setLandingReplaceMode((prev) => ({
      ...prev,
      [field]: true,
    }));
  };

  const closeLandingReplaceMode = (
    field: keyof AdminInfluencerLandingAssetsPayload,
    hasPreview: boolean
  ) => {
    setPendingLandingUploads((prev) => {
      if (!prev[field]) return prev;
      const next = { ...prev, [field]: null };
      if (!hasPendingLandingFiles(next)) return {};
      return next;
    });
    setLandingReplaceMode((prev) => ({
      ...prev,
      [field]: !hasPreview,
    }));
  };

  const closeTelegramReplaceMode = (hasPreview: boolean) => {
    setPendingTelegramAudio(null);
    setTelegramAudioReplaceMode(!hasPreview);
  };

  return (
    <AdminLayout
      title="Influencer Assets Manager"
      subtitle="Manage landing hero assets, background media, signatures, and Telegram welcome audio."
    >
      <div className={styles["page"]}>
        <AdminTwoColumn
          sidebar={
            <aside className={styles["sidebar"]}>
              <div className={styles["sidebar-top"]}>
                <div>
                  <h2 className={styles["sidebar-title"]}>Influencer Assets</h2>
                  <p className={styles["sidebar-subtitle"]}>
                    Select an influencer to manage landing and Telegram assets.
                  </p>
                </div>
                <div className={styles["sidebar-meta"]}>
                  {loadingInfluencers ? "Loading..." : `${influencers.length} loaded`}
                </div>
              </div>

              <div className={styles["sidebar-actions"]}>
                <div className={styles["search"]}>
                  <input
                    value={searchTerm}
                    onChange={(event) => setSearchTerm(event.target.value)}
                    placeholder="Search by name or ID"
                  />
                </div>
              </div>

              <div className={styles["influencer-list"]}>
                {loadingInfluencers ? (
                  <div className={styles["list-placeholder"]}>Loading influencers…</div>
                ) : listError ? (
                  <div className={styles["list-placeholder"]}>{listError}</div>
                ) : filteredInfluencers.length === 0 ? (
                  <div className={styles["list-placeholder"]}>No influencers found</div>
                ) : (
                  filteredInfluencers.map((influencer) => {
                    const isActive = influencer.id === selectedInfluencerId;
                    return (
                      <button
                        type="button"
                        key={influencer.id}
                        className={`${styles["influencer-item"]} ${isActive ? styles["influencer-item--active"] : ""
                          }`}
                        onClick={() => setSelectedInfluencerId(influencer.id)}
                      >
                        <span className={styles["influencer-name"]}>
                          {influencer.display_name || influencer.id}
                        </span>
                        <span className={styles["influencer-id"]}>@{influencer.id}</span>
                      </button>
                    );
                  })
                )}
              </div>
            </aside>
          }
        >
          <section className={styles["detail-panel"]}>
            {!selectedInfluencerId && !loadingInfluencers && (
              <div className={styles["empty-state"]}>
                Select an influencer to manage landing assets.
              </div>
            )}

            {selectedInfluencerId && (
              <div className={styles["detail-card"]}>
                <div className={styles["detail-header"]}>
                  <div>
                    <h2>{selectedInfluencer?.display_name || selectedInfluencerId}</h2>
                    <p>
                      Landing asset previews, staged uploads, and Telegram welcome audio.
                    </p>
                  </div>
                  <div className={styles["detail-meta"]}>
                    <span>@{selectedInfluencerId}</span>
                    <span>
                      Updated {formatDate(landingAssets?.updated_at || telegramAudio?.updated_at)}
                    </span>
                  </div>
                </div>

                {pageMessage && (
                  <div className={`${styles["message"]} ${styles["message--success"]}`}>
                    {pageMessage}
                  </div>
                )}

                <div className={styles["section-card"]}>
                  <div className={styles["section-header"]}>
                    <div>
                      <h3>Landing Assets</h3>
                      <p>Hero, signature, background videos, and background images.</p>
                    </div>
                    <div className={styles["pill-row"]}>
                      <span className={landingAssets?.has_hero ? styles["pill-active"] : styles["pill-muted"]}>
                        {landingAssets?.has_hero ? "Hero ready" : "Hero incomplete"}
                      </span>
                      <span className={landingAssets?.has_signature ? styles["pill-active"] : styles["pill-muted"]}>
                        {landingAssets?.has_signature ? "Signature ready" : "Signature incomplete"}
                      </span>
                      <span className={landingAssets?.has_background_videos ? styles["pill-active"] : styles["pill-muted"]}>
                        {landingAssets?.has_background_videos ? "Videos ready" : "Videos incomplete"}
                      </span>
                      <span className={landingAssets?.has_complete_background_images ? styles["pill-active"] : styles["pill-muted"]}>
                        {landingAssets?.has_complete_background_images ? "Images complete" : "Images incomplete"}
                      </span>
                    </div>
                  </div>

                  {landingError && (
                    <div className={`${styles["message"]} ${styles["message--error"]}`}>
                      {landingError}
                    </div>
                  )}

                  {loadingLandingAssets ? (
                    <div className={styles["empty-state"]}>Loading landing assets…</div>
                  ) : (
                    <>
                      <div className={styles["landing-groups"]}>
                        {LANDING_GROUPS.map((group) => (
                          <div key={group.title} className={styles["group-card"]}>
                            <div className={styles["group-header"]}>
                              <div>
                                <h4>{group.title}</h4>
                                <p>{group.description}</p>
                              </div>
                            </div>

                            <div
                              className={`${styles["group-slots"]} ${group.columns === 3
                                  ? styles["group-slots--three"]
                                  : styles["group-slots--two"]
                                }`}
                            >
                              {group.slots.map((slot) => {
                                const previewUrl = landingAssets?.[
                                  slot.responseUrlKey
                                ] as string | null | undefined;
                                const previewContentType = slot.responseContentTypeKey
                                  ? (landingAssets?.[
                                    slot.responseContentTypeKey
                                  ] as string | null | undefined)
                                  : null;
                                const pendingFile = pendingLandingUploads[slot.field] ?? null;
                                const isReplaceMode =
                                  Boolean(pendingFile) ||
                                  Boolean(landingReplaceMode[slot.field]) ||
                                  !previewUrl;

                                return (
                                  <div key={slot.field} className={styles["slot-card"]}>
                                    {previewUrl && !isReplaceMode && (
                                      <AssetPreview
                                        label={slot.label}
                                        url={previewUrl}
                                        type={slot.previewKind}
                                        frame={slot.previewFrame}
                                        emptyLabel={slot.emptyLabel}
                                        contentType={previewContentType}
                                        action={
                                          <button
                                            type="button"
                                            className={styles["slot-toggle"]}
                                            onClick={() => openLandingReplaceMode(slot.field)}
                                            disabled={uploadingLanding}
                                            aria-label={`Replace ${slot.label}`}
                                          >
                                            <span className={styles["slot-toggle-x"]}>×</span>
                                          </button>
                                        }
                                      />
                                    )}

                                    {!previewUrl && !isReplaceMode && (
                                      <div className={styles["slot-label-row"]}>
                                        <div className={styles["asset-label"]}>{slot.label}</div>
                                      </div>
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
                                                closeLandingReplaceMode(
                                                  slot.field,
                                                  Boolean(previewUrl)
                                                )
                                              }
                                              disabled={uploadingLanding}
                                            >
                                              Cancel
                                            </button>
                                          )}
                                        </div>
                                        <FileDropzone
                                          title={`Upload ${slot.label}`}
                                          description={slot.hint}
                                          accept={slot.accept}
                                          file={pendingFile}
                                          onFileChange={(file) =>
                                            handleLandingFileChange(slot.field, file)
                                          }
                                          onFileRemove={() =>
                                            handleLandingFileChange(slot.field, null)
                                          }
                                          browseLabel="Browse"
                                          disabled={uploadingLanding}
                                          metaText={slot.metaText}
                                        />
                                      </>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        ))}
                      </div>

                      <div className={styles["action-row"]}>
                        <div className={styles["action-copy"]}>
                          {landingStagedCount > 0
                            ? `${landingStagedCount} file${landingStagedCount === 1 ? "" : "s"} staged for upload`
                            : "Stage any subset of files, then upload them together."}
                        </div>
                        <button
                          type="button"
                          className={styles["primary"]}
                          onClick={handleUploadLandingAssets}
                          disabled={uploadingLanding || !hasPendingLandingFiles(pendingLandingUploads)}
                        >
                          {uploadingLanding ? "Uploading..." : "Upload selected landing assets"}
                        </button>
                      </div>
                    </>
                  )}
                </div>

                <div className={styles["section-card"]}>
                  <div className={styles["section-header"]}>
                    <div>
                      <h3>Telegram Welcome Audio</h3>
                      <p>Upload or replace the audio used for Telegram welcome flows.</p>
                    </div>
                    <div className={styles["pill-row"]}>
                      <span className={telegramAudio ? styles["pill-active"] : styles["pill-muted"]}>
                        {telegramAudio ? "Audio ready" : "No audio"}
                      </span>
                    </div>
                  </div>

                  {telegramAudioError && (
                    <div className={`${styles["message"]} ${styles["message--error"]}`}>
                      {telegramAudioError}
                    </div>
                  )}

                  {loadingTelegramAudio ? (
                    <div className={styles["empty-state"]}>Loading telegram welcome audio…</div>
                  ) : (
                    <div className={styles["audio-card"]}>
                      {telegramAudio && !telegramAudioReplaceMode && !pendingTelegramAudio ? (
                        <>
                          <div className={styles["audio-preview-header"]}>
                            <div className={styles["audio-meta"]}>
                              Updated {formatDate(telegramAudio.updated_at)}
                            </div>
                            <button
                              type="button"
                              className={styles["slot-toggle"]}
                              onClick={() => setTelegramAudioReplaceMode(true)}
                              disabled={uploadingTelegramAudio}
                              aria-label="Replace telegram welcome audio"
                            >
                              <span className={styles["slot-toggle-x"]}>×</span>
                            </button>
                          </div>
                          <audio controls className={styles["audio-player"]}>
                            <source src={telegramAudio.url} type={telegramAudio.content_type || undefined} />
                          </audio>
                        </>
                      ) : telegramAudioMissing ? (
                        <div className={styles["empty-state"]}>
                          No telegram welcome audio uploaded yet.
                        </div>
                      ) : null}

                      {(!telegramAudio || telegramAudioReplaceMode || pendingTelegramAudio) && (
                        <>
                          <div className={styles["replace-header"]}>
                            <div className={styles["asset-label"]}>
                              {telegramAudio ? "Replace Telegram Welcome Audio" : "Telegram Welcome Audio"}
                            </div>
                            {telegramAudio && (
                              <button
                                type="button"
                                className={styles["replace-cancel"]}
                                onClick={() => closeTelegramReplaceMode(Boolean(telegramAudio))}
                                disabled={uploadingTelegramAudio}
                              >
                                Cancel
                              </button>
                            )}
                          </div>
                          <FileDropzone
                            title="Upload Telegram Welcome Audio"
                            description="Drag and drop an audio file here, or browse to stage a replacement."
                            accept="audio/*"
                            file={pendingTelegramAudio}
                            onFileChange={(file) => {
                              setPendingTelegramAudio(file);
                              if (file) {
                                setTelegramAudioReplaceMode(true);
                              }
                            }}
                            onFileRemove={() => setPendingTelegramAudio(null)}
                            browseLabel="Browse"
                            disabled={uploadingTelegramAudio}
                            metaText="Accepted: audio/*"
                          />
                        </>
                      )}

                      <div className={styles["action-row"]}>
                        <div className={styles["action-copy"]}>
                          {pendingTelegramAudio
                            ? "One replacement audio file is staged."
                            : "Stage a single audio file, then upload it manually."}
                        </div>
                        <button
                          type="button"
                          className={styles["primary"]}
                          onClick={handleUploadTelegramAudio}
                          disabled={uploadingTelegramAudio || !pendingTelegramAudio}
                        >
                          {uploadingTelegramAudio ? "Uploading..." : "Upload telegram welcome audio"}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </section>
        </AdminTwoColumn>
      </div>
    </AdminLayout>
  );
};

export default AdminInfluencerAssets;
