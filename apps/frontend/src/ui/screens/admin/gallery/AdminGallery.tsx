import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { apiClient } from "@/api/apis";
import type {
  CharacterGalleryCandidate,
  CharacterGalleryResponse,
  CharacterGalleryStage,
} from "@/api/models/characterGallery";
import type { GalleryStageConfig } from "@/api/models/galleryStages";
import {
  buildStageVideoPrompt,
  type GalleryStagesConfigResponse,
} from "@/api/models/galleryStages";
import { InfluencerDataModel } from "@/data/models/InfluencerDataModel";
import { AdminInfluencerRepo } from "@/data/repositories/AdminInfluencerRepo";
import {
  AdminInfluencerCharacter,
  AdminServices,
} from "@/api/services/AdminServices";
import FileDropzone from "@/ui/components/uploads/FileDropzone";
import AdminLayout from "@/ui/screens/admin/AdminLayout";
import AdminTwoColumn from "@/ui/screens/admin/AdminTwoColumn";
import chrome from "@/ui/screens/admin/shared/AdminChrome.module.css";
import styles from "./AdminGallery.module.css";

const admin = AdminServices(apiClient);
const adminInfluencerRepo = AdminInfluencerRepo();

const VARIANT_OPTIONS = [1, 2, 3, 4, 5];

function resolveStageTags(stage: GalleryStageConfig): string[] {
  if (stage.tags?.length) {
    return stage.tags;
  }
  return stage.scene_description
    .split(",")
    .map((tag) => tag.trim().toLowerCase())
    .filter(Boolean);
}

function StageTagEditor({
  tags,
  onChange,
}: {
  tags: string[];
  onChange: (tags: string[]) => void;
}) {
  const [draft, setDraft] = useState("");

  const addTag = (raw: string) => {
    const tag = raw.trim().toLowerCase();
    if (!tag || tags.includes(tag)) {
      return;
    }
    onChange([...tags, tag]);
    setDraft("");
  };

  return (
    <div className={styles.tagEditor}>
      <div className={styles.tagList}>
        {tags.map((tag) => (
          <span key={tag} className={styles.tagChip}>
            {tag}
            <button
              type="button"
              className={styles.tagRemove}
              onClick={() => onChange(tags.filter((item) => item !== tag))}
              aria-label={`Remove tag ${tag}`}
            >
              ×
            </button>
          </span>
        ))}
      </div>
      <input
        className={styles.tagInput}
        value={draft}
        placeholder="Add tag and press Enter"
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === ",") {
            event.preventDefault();
            addTag(draft);
          }
        }}
        onBlur={() => {
          if (draft.trim()) {
            addTag(draft);
          }
        }}
      />
    </div>
  );
}

const getErrorMessage = (error: unknown, fallback: string) => {
  const err = error as { response?: { data?: { detail?: string } }; message?: string };
  return err?.response?.data?.detail || err?.message || fallback;
};

function AutoplayLoopVideo({ url, className }: { url: string; className?: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) {
      return;
    }

    const play = () => {
      video.muted = true;
      void video.play().catch(() => undefined);
    };

    play();
    video.addEventListener("loadeddata", play);
    video.addEventListener("canplay", play);

    return () => {
      video.removeEventListener("loadeddata", play);
      video.removeEventListener("canplay", play);
    };
  }, [url]);

  return (
    <video
      ref={videoRef}
      src={url}
      className={className}
      autoPlay
      loop
      muted
      playsInline
      preload="auto"
    />
  );
}

function PausedScenarioVideo({ url, className }: { url: string; className?: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) {
      return;
    }

    const seekToPreviewFrame = () => {
      const target = Number.isFinite(video.duration)
        ? Math.min(Math.max(video.duration * 0.2, 0.2), video.duration - 0.05)
        : 0.2;
      try {
        video.currentTime = target;
      } catch {
        // Ignore seek errors while metadata is still loading.
      }
    };

    video.muted = true;
    video.addEventListener("loadedmetadata", seekToPreviewFrame);
    seekToPreviewFrame();

    return () => {
      video.removeEventListener("loadedmetadata", seekToPreviewFrame);
    };
  }, [url]);

  return (
    <video
      ref={videoRef}
      src={url}
      className={className}
      muted
      playsInline
      preload="metadata"
    />
  );
}

function GalleryMediaPreview({
  url,
  alt,
  kind = "image",
  previewKey,
}: {
  url: string;
  alt: string;
  kind?: "image" | "video" | "scenario-video";
  previewKey?: string | number;
}) {
  return (
    <div className={styles.mediaPreview}>
      {kind === "video" ? (
        <AutoplayLoopVideo
          key={previewKey ?? url}
          url={url}
          className={styles.mediaVideo}
        />
      ) : kind === "scenario-video" ? (
        <PausedScenarioVideo
          key={previewKey ?? url}
          url={url}
          className={styles.mediaVideo}
        />
      ) : (
        <img
          key={previewKey ?? url}
          src={url}
          alt={alt}
          className={styles.mediaImage}
        />
      )}
    </div>
  );
}

const AdminGallery: React.FC = () => {
  const [influencers, setInfluencers] = useState<InfluencerDataModel[]>([]);
  const [selectedInfluencerId, setSelectedInfluencerId] = useState<string | null>(null);
  const [characters, setCharacters] = useState<AdminInfluencerCharacter[]>([]);
  const [selectedCharacterId, setSelectedCharacterId] = useState<number | null>(null);
  const [gallery, setGallery] = useState<CharacterGalleryResponse | null>(null);
  const [stagesConfig, setStagesConfig] = useState<GalleryStagesConfigResponse | null>(null);
  const [activeStageIndex, setActiveStageIndex] = useState(1);
  const [pendingSourcePhotos, setPendingSourcePhotos] = useState<Record<number, File | null>>({});
  const [approveVariantByCandidate, setApproveVariantByCandidate] = useState<
    Record<number, number>
  >({});
  const [loadingInfluencers, setLoadingInfluencers] = useState(false);
  const [loadingCharacters, setLoadingCharacters] = useState(false);
  const [loadingGallery, setLoadingGallery] = useState(false);
  const [loadingStagesConfig, setLoadingStagesConfig] = useState(false);
  const [savingStagesConfig, setSavingStagesConfig] = useState(false);
  const [reembeddingScenes, setReembeddingScenes] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [clearingStage, setClearingStage] = useState(false);
  const [deletingVariantIndex, setDeletingVariantIndex] = useState<number | null>(null);
  const [reviewingCandidateId, setReviewingCandidateId] = useState<number | null>(null);
  const [pageMessage, setPageMessage] = useState<string | null>(null);
  const [pageError, setPageError] = useState<string | null>(null);

  const applyGalleryToState = useCallback((data: CharacterGalleryResponse) => {
    setGallery(data);
  }, []);

  const loadStagesConfig = useCallback(async (influencerId: string, characterId: number) => {
    setLoadingStagesConfig(true);
    setPageError(null);
    try {
      const data = await admin.getGalleryStagesConfig(influencerId, characterId);
      setStagesConfig(data);
    } catch (e) {
      setStagesConfig(null);
      setPageError(getErrorMessage(e, "Failed to load gallery stages."));
    } finally {
      setLoadingStagesConfig(false);
    }
  }, []);

  const loadInfluencers = useCallback(async () => {
    setLoadingInfluencers(true);
    try {
      const rows = await adminInfluencerRepo.getInfluencers();
      setInfluencers(rows);
    } catch (e) {
      setPageError(getErrorMessage(e, "Failed to load influencers."));
    } finally {
      setLoadingInfluencers(false);
    }
  }, []);

  const loadCharacters = useCallback(async (influencerId: string) => {
    setLoadingCharacters(true);
    setPageError(null);
    try {
      const rows = await admin.listInfluencerAdultCharacters(influencerId);
      setCharacters(rows);
      setSelectedCharacterId((prev) => {
        if (prev && rows.some((row) => row.id === prev)) return prev;
        return rows[0]?.id ?? null;
      });
    } catch (e) {
      setCharacters([]);
      setSelectedCharacterId(null);
      setPageError(getErrorMessage(e, "Failed to load characters."));
    } finally {
      setLoadingCharacters(false);
    }
  }, []);

  const loadGallery = useCallback(
    async (influencerId: string, characterId: number) => {
      setLoadingGallery(true);
      setPageError(null);
      try {
        const data = await admin.getCharacterGallery(influencerId, characterId);
        applyGalleryToState(data);
      } catch (e) {
        setGallery(null);
        setPageError(getErrorMessage(e, "Failed to load gallery."));
      } finally {
        setLoadingGallery(false);
      }
    },
    [applyGalleryToState]
  );

  useEffect(() => {
    void loadInfluencers();
  }, [loadInfluencers]);

  useEffect(() => {
    if (!selectedInfluencerId) {
      setCharacters([]);
      setSelectedCharacterId(null);
      setGallery(null);
      setStagesConfig(null);
      return;
    }
    void loadCharacters(selectedInfluencerId);
  }, [loadCharacters, selectedInfluencerId]);

  useEffect(() => {
    if (!selectedInfluencerId || selectedCharacterId == null) {
      setStagesConfig(null);
      return;
    }
    void loadStagesConfig(selectedInfluencerId, selectedCharacterId);
  }, [loadStagesConfig, selectedCharacterId, selectedInfluencerId]);

  useEffect(() => {
    if (!selectedInfluencerId || selectedCharacterId == null) {
      setGallery(null);
      return;
    }
    void loadGallery(selectedInfluencerId, selectedCharacterId);
  }, [loadGallery, selectedCharacterId, selectedInfluencerId]);

  useEffect(() => {
    setPendingSourcePhotos({});
    setApproveVariantByCandidate({});
    setActiveStageIndex(1);
    setPageMessage(null);
    setPageError(null);
  }, [selectedCharacterId]);

  const selectedInfluencer = useMemo(
    () => influencers.find((item) => item.id === selectedInfluencerId) ?? null,
    [influencers, selectedInfluencerId]
  );

  const selectedCharacter = useMemo(
    () => characters.find((item) => item.id === selectedCharacterId) ?? null,
    [characters, selectedCharacterId]
  );

  const activeStage: CharacterGalleryStage | null = useMemo(
    () => gallery?.stages.find((stage) => stage.stage_index === activeStageIndex) ?? null,
    [activeStageIndex, gallery]
  );

  const pendingCandidates = useMemo(
    () =>
      (activeStage?.candidates ?? []).filter(
        (candidate) => candidate.status === "pending_review"
      ),
    [activeStage]
  );

  const activeStageConfig = useMemo(
    () => stagesConfig?.stages.find((stage) => stage.stage_index === activeStageIndex) ?? null,
    [activeStageIndex, stagesConfig]
  );

  const activeDefaultStageConfig = useMemo(() => {
    const defaults = stagesConfig?.default_stages?.length
      ? stagesConfig.default_stages
      : stagesConfig?.stages;
    return defaults?.find((stage) => stage.stage_index === activeStageIndex) ?? null;
  }, [activeStageIndex, stagesConfig]);

  const activeLoopingPrompt = useMemo(
    () => (activeDefaultStageConfig ? buildStageVideoPrompt(activeDefaultStageConfig) : ""),
    [activeDefaultStageConfig]
  );

  const outfitReferenceVideoUrl = selectedCharacter?.video_mp4_url ?? null;
  const outfitReferenceImageUrl = useMemo(() => {
    if (outfitReferenceVideoUrl) {
      return null;
    }
    if (selectedCharacter?.video_preview_png_url) {
      return selectedCharacter.video_preview_png_url;
    }
    if (selectedCharacter?.default_artwork_url) {
      return selectedCharacter.default_artwork_url;
    }
    if (selectedCharacter?.photo_url) {
      return selectedCharacter.photo_url;
    }
    return null;
  }, [outfitReferenceVideoUrl, selectedCharacter]);

  const hasOutfitReference = Boolean(outfitReferenceVideoUrl || outfitReferenceImageUrl);

  const outfitReferenceSource = outfitReferenceVideoUrl
    ? "scenario video (sharp frame used for merge)"
    : selectedCharacter?.video_preview_png_url
      ? "call screen preview"
      : selectedCharacter?.default_artwork_url
        ? "default artwork"
        : selectedCharacter?.photo_url
          ? "character photo"
          : null;

  const pendingSourceFile = pendingSourcePhotos[activeStageIndex] ?? null;

  const pendingSourcePreviewUrl = useMemo(() => {
    if (!pendingSourceFile) return null;
    return URL.createObjectURL(pendingSourceFile);
  }, [pendingSourceFile]);

  useEffect(() => {
    return () => {
      if (pendingSourcePreviewUrl) {
        URL.revokeObjectURL(pendingSourcePreviewUrl);
      }
    };
  }, [pendingSourcePreviewUrl]);

  const canGenerateLoopingVideo = Boolean(
    pendingSourceFile && hasOutfitReference && activeLoopingPrompt.trim()
  );

  const activeStageHero = useMemo(() => {
    if (!activeStage) return null;
    const filled = activeStage.variants.find(
      (variant) => variant.video_mp4_url || variant.poster_url
    );
    if (!filled) return null;
    if (filled.video_mp4_url) {
      return {
        url: filled.video_mp4_url,
        kind: "video" as const,
        slot: filled.variant_index,
      };
    }
    if (filled.poster_url) {
      return {
        url: filled.poster_url,
        kind: "image" as const,
        slot: filled.variant_index,
      };
    }
    return null;
  }, [activeStage]);

  const handleStageTagsChange = (tags: string[]) => {
    if (!stagesConfig) return;
    setStagesConfig({
      ...stagesConfig,
      stages: stagesConfig.stages.map((stage) =>
        stage.stage_index === activeStageIndex
          ? { ...stage, tags, scene_description: tags.join(", ") }
          : stage
      ),
    });
  };

  const handleStageConfigFieldChange = (
    field: keyof Pick<
      GalleryStageConfig,
      "title" | "description" | "scene_description" | "video_prompt"
    >,
    value: string
  ) => {
    if (!stagesConfig) return;
    setStagesConfig({
      ...stagesConfig,
      stages: stagesConfig.stages.map((stage) =>
        stage.stage_index === activeStageIndex ? { ...stage, [field]: value } : stage
      ),
    });
  };

  const handleSaveStagesConfig = async () => {
    if (!selectedInfluencerId || selectedCharacterId == null || !stagesConfig) return;
    setSavingStagesConfig(true);
    setPageMessage(null);
    setPageError(null);
    try {
      const saved = await admin.saveGalleryStagesConfig(
        selectedInfluencerId,
        selectedCharacterId,
        { stages: stagesConfig.stages }
      );
      setStagesConfig(saved);
      setPageMessage(`Gallery stages saved for ${selectedCharacter?.name ?? "character"}.`);
    } catch (e) {
      setPageError(getErrorMessage(e, "Failed to save gallery stages."));
    } finally {
      setSavingStagesConfig(false);
    }
  };

  const handleReembedSceneDescriptions = async () => {
    if (!selectedInfluencerId || selectedCharacterId == null) return;
    setReembeddingScenes(true);
    setPageMessage(null);
    setPageError(null);
    try {
      const result = await admin.reembedGallerySceneDescriptions(
        selectedInfluencerId,
        selectedCharacterId,
        true
      );
      if (result.updated === 0 && result.failed > 0) {
        setPageError(
          `Re-embed failed for ${result.failed} variant(s). Check OpenAI embedding config.`
        );
        return;
      }
      if (result.updated === 0) {
        setPageMessage(
          "No variants to update. Approve gallery videos first, or add scene keywords to stages."
        );
        return;
      }
      setPageMessage(
        `Re-embedded scene keywords for ${result.updated} variant(s)${
          result.skipped > 0 ? ` (${result.skipped} skipped — no keywords)` : ""
        }${result.failed > 0 ? ` · ${result.failed} failed` : ""}.`
      );
    } catch (e) {
      setPageError(getErrorMessage(e, "Failed to re-embed scene descriptions."));
    } finally {
      setReembeddingScenes(false);
    }
  };

  const handleGenerate = async () => {
    if (!selectedInfluencerId || selectedCharacterId == null) return;
    if (!activeLoopingPrompt.trim()) {
      setPageError("Default looping prompt missing for this character stage.");
      return;
    }
    const faceFile = pendingSourcePhotos[activeStageIndex];
    if (!faceFile) {
      setPageError("Upload a face photo first.");
      return;
    }
    if (!hasOutfitReference) {
      setPageError(
        "No scene reference. Upload the call-screen scenario video in Admin → Influencer → Characters."
      );
      return;
    }
    setGenerating(true);
    setPageMessage(null);
    setPageError(null);
    try {
      const data = await admin.generateGalleryVariations(
        selectedInfluencerId,
        selectedCharacterId,
        activeStageIndex,
        { facePhoto: faceFile, variation_count: 1 }
      );
      setGallery(data);
      applyGalleryToState(data);
      setPendingSourcePhotos((prev) => ({ ...prev, [activeStageIndex]: null }));
      setPageMessage("Looping video created — review and approve below.");
    } catch (e) {
      setPageError(getErrorMessage(e, "Failed to generate looping video."));
    } finally {
      setGenerating(false);
    }
  };

  const handleApprove = async (candidate: CharacterGalleryCandidate) => {
    if (!selectedInfluencerId || selectedCharacterId == null) return;
    const variantIndex = approveVariantByCandidate[candidate.id] ?? 1;
    setReviewingCandidateId(candidate.id);
    setPageMessage(null);
    setPageError(null);
    try {
      const data = await admin.approveGalleryCandidate(
        selectedInfluencerId,
        selectedCharacterId,
        candidate.id,
        {
          variant_index: variantIndex,
          scene_description:
            activeStageConfig?.tags?.join(", ") ||
            activeStageConfig?.scene_description ||
            candidate.generation_prompt,
        }
      );
      setGallery(data);
      applyGalleryToState(data);
      setPageMessage(`Approved into variant ${variantIndex}.`);
    } catch (e) {
      setPageError(getErrorMessage(e, "Failed to approve variation."));
    } finally {
      setReviewingCandidateId(null);
    }
  };

  const handleReject = async (candidate: CharacterGalleryCandidate) => {
    if (!selectedInfluencerId || selectedCharacterId == null) return;
    setReviewingCandidateId(candidate.id);
    setPageMessage(null);
    setPageError(null);
    try {
      const data = await admin.rejectGalleryCandidate(
        selectedInfluencerId,
        selectedCharacterId,
        candidate.id
      );
      setGallery(data);
      applyGalleryToState(data);
      setPageMessage("Variation rejected.");
    } catch (e) {
      setPageError(getErrorMessage(e, "Failed to reject variation."));
    } finally {
      setReviewingCandidateId(null);
    }
  };

  const handleClearStage = async () => {
    if (!selectedInfluencerId || selectedCharacterId == null) return;
    const stageLabel = activeStageConfig?.title || `Stage ${activeStageIndex}`;
    const characterLabel = selectedCharacter?.name || "this character";
    const confirmed = window.confirm(
      `Clear ${stageLabel} for ${characterLabel}?\n\nThis removes:\n• Stage-specific source photo\n• All pending/failed Grok variations\n• All approved video slots for this stage\n\nThe default character photo is kept.`
    );
    if (!confirmed) return;

    setClearingStage(true);
    setPageMessage(null);
    setPageError(null);
    try {
      const data = await admin.clearGalleryStage(
        selectedInfluencerId,
        selectedCharacterId,
        activeStageIndex
      );
      setGallery(data);
      applyGalleryToState(data);
      setPendingSourcePhotos((prev) => ({ ...prev, [activeStageIndex]: null }));
      setApproveVariantByCandidate({});
      setPageMessage(`Stage ${activeStageIndex} cleared. Default photo and prompts are ready for a fresh generate.`);
    } catch (e) {
      setPageError(getErrorMessage(e, "Failed to clear stage."));
    } finally {
      setClearingStage(false);
    }
  };

  const handleDeleteVariant = async (variantIndex: number) => {
    if (!selectedInfluencerId || selectedCharacterId == null) return;
    const stageLabel = activeStageConfig?.title || `Stage ${activeStageIndex}`;
    const confirmed = window.confirm(
      `Remove slot ${variantIndex} from ${stageLabel}?\n\nThis deletes the approved video and poster for this slot only. Other slots are kept.`
    );
    if (!confirmed) return;

    setDeletingVariantIndex(variantIndex);
    setPageMessage(null);
    setPageError(null);
    try {
      await admin.deleteCharacterGalleryVariant(
        selectedInfluencerId,
        selectedCharacterId,
        activeStageIndex,
        variantIndex
      );
      await loadGallery(selectedInfluencerId, selectedCharacterId);
      setPageMessage(`Slot ${variantIndex} removed from ${stageLabel}.`);
    } catch (e) {
      setPageError(getErrorMessage(e, "Failed to remove approved variant."));
    } finally {
      setDeletingVariantIndex(null);
    }
  };

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
      title="Scenario Gallery"
      subtitle="Configure gallery stages, then generate looping videos per scenario."
    >
      <AdminTwoColumn sidebar={sidebar}>
        <section className={chrome["main"]}>
          {!selectedInfluencerId && !loadingInfluencers && (
            <div className={chrome["emptyState"]}>
              Select an influencer to manage stage videos.
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
                    Upload photo → Grok looping videos → Approve into stage slots
                  </div>
                </div>
                <div className={styles.toolbar}>
                  <select
                    className={styles.characterSelect}
                    value={selectedCharacterId ?? ""}
                    onChange={(event) =>
                      setSelectedCharacterId(
                        event.target.value ? Number(event.target.value) : null
                      )
                    }
                    disabled={loadingCharacters || characters.length === 0}
                  >
                    {characters.map((character) => (
                      <option key={character.id} value={character.id}>
                        {character.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {pageMessage && (
                <div className={`${chrome["message"]} ${chrome["messageSuccess"]}`}>
                  {pageMessage}
                </div>
              )}
              {pageError && (
                <div className={`${chrome["message"]} ${chrome["messageError"]}`}>
                  {pageError}
                </div>
              )}

              {loadingStagesConfig && (
                <div className={chrome["emptyState"]}>Loading gallery stages...</div>
              )}

              {stagesConfig && (
                <div className={styles.stagesConfigPanel}>
                  <div className={styles.configHeader}>
                    <h2 className={styles.configTitle}>
                      Gallery stages — {selectedCharacter?.name ?? "character"}
                    </h2>
                    <p className={styles.hint}>
                      Synced with the conversation scenario (
                      {stagesConfig.source === "override"
                        ? "custom override saved"
                        : stagesConfig.source === "legacy_influencer"
                          ? "legacy influencer config"
                          : `defaults from ${stagesConfig.character_slug}.json`}
                      ). Title + description = call panel. Scene keywords = video matching.
                    </p>
                  </div>

                  <div className={styles.stageTabs}>
                    {stagesConfig.stages.map((stage) => {
                      const stageGallery = gallery?.stages.find(
                        (item) => item.stage_index === stage.stage_index
                      );
                      const hasStageContent =
                        (stageGallery?.candidates.length ?? 0) > 0 ||
                        stageGallery?.variants.some(
                          (variant) => variant.has_mp4 || variant.has_poster
                        );
                      return (
                      <button
                        key={stage.stage_index}
                        type="button"
                        className={`${styles.stageTab} ${
                          activeStageIndex === stage.stage_index ? styles.stageTabActive : ""
                        } ${hasStageContent ? styles.stageTabHasContent : ""}`}
                        onClick={() => setActiveStageIndex(stage.stage_index)}
                      >
                        {stage.title.trim() || `Stage ${stage.stage_index}`}
                      </button>
                      );
                    })}
                  </div>

                  {activeStageConfig && (
                    <div className={styles.stageFields}>
                      <div>
                        <label className={styles.fieldLabel} htmlFor="stage-title">
                          Stage title
                        </label>
                        <input
                          id="stage-title"
                          className={styles.fieldInput}
                          value={activeStageConfig.title}
                          onChange={(event) =>
                            handleStageConfigFieldChange("title", event.target.value)
                          }
                        />
                      </div>
                      <div>
                        <label className={styles.fieldLabel} htmlFor="stage-description">
                          Panel description (shown during call)
                        </label>
                        <textarea
                          id="stage-description"
                          className={styles.fieldTextarea}
                          value={activeStageConfig.description}
                          onChange={(event) =>
                            handleStageConfigFieldChange("description", event.target.value)
                          }
                        />
                      </div>
                      <div>
                        <label className={styles.fieldLabel}>Tags (match conversation → swap video)</label>
                        <StageTagEditor
                          tags={resolveStageTags(activeStageConfig)}
                          onChange={handleStageTagsChange}
                        />
                        <p className={styles.hint}>
                          Add short phrases the agent or user might say for this stage. Tags
                          sync to approved videos when you re-embed or approve.
                        </p>
                      </div>
                      <div>
                        <label className={styles.fieldLabel} htmlFor="stage-video-prompt">
                          Video prompt (Grok looping motion)
                        </label>
                        <textarea
                          id="stage-video-prompt"
                          className={styles.fieldTextarea}
                          value={activeStageConfig.video_prompt}
                          onChange={(event) =>
                            handleStageConfigFieldChange("video_prompt", event.target.value)
                          }
                          placeholder="Motion and loop instructions Grok uses when you generate variations..."
                        />
                        <p className={styles.hint}>
                          Each field maps to the conversation prompt: panel copy, live scene
                          matching, and Grok video generation for this character stage.
                        </p>
                      </div>
                      <div className={styles.stageActions}>
                        <button
                          type="button"
                          className={styles.saveButton}
                          onClick={handleSaveStagesConfig}
                          disabled={savingStagesConfig || reembeddingScenes}
                        >
                          {savingStagesConfig ? "Saving..." : "Save gallery stages"}
                        </button>
                        <button
                          type="button"
                          className={styles.secondaryButton}
                          onClick={handleReembedSceneDescriptions}
                          disabled={
                            reembeddingScenes ||
                            savingStagesConfig ||
                            selectedCharacterId == null
                          }
                          title="Sync scene keywords from stage config and regenerate embeddings for live call matching"
                        >
                          {reembeddingScenes ? "Re-embedding..." : "Re-embed scene keywords"}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {loadingGallery && selectedCharacterId != null && (
                <div className={chrome["emptyState"]}>Loading gallery...</div>
              )}

              {!loadingGallery && selectedCharacterId != null && gallery && activeStage && (
                <>
                  <div className={styles.stagePanel}>
                    {selectedCharacter && (
                      <div className={styles.characterBanner}>
                        Generating for stage {activeStageIndex}:{" "}
                        <strong>{activeStageConfig?.title || `Stage ${activeStageIndex}`}</strong>
                        {" · "}
                        scenario <strong>{selectedCharacter.name}</strong>
                        <span className={styles.characterSlug}>({selectedCharacter.slug})</span>
                        <p className={styles.characterBannerHint}>
                          Upload a face photo — Grok merges it onto the call-screen scenario scene
                          (video preview), then generates a looping video for this stage.
                        </p>
                        <button
                          type="button"
                          className={styles.clearStageButton}
                          onClick={handleClearStage}
                          disabled={clearingStage || generating}
                        >
                          {clearingStage ? "Clearing..." : "Clear this stage"}
                        </button>
                      </div>
                    )}

                    {activeStageHero && (
                      <div className={styles.stageHero}>
                        <h3 className={styles.sectionTitle}>
                          Stage {activeStageIndex} — approved preview (slot {activeStageHero.slot})
                        </h3>
                        <GalleryMediaPreview
                          key={`hero-${selectedCharacterId}-${activeStageIndex}-${activeStageHero.url}`}
                          previewKey={`hero-${selectedCharacterId}-${activeStageIndex}`}
                          url={activeStageHero.url}
                          alt={`Stage ${activeStageIndex} approved preview`}
                          kind={activeStageHero.kind}
                        />
                      </div>
                    )}

                    <div className={styles.grokPanel}>
                      <h3 className={styles.sectionTitle}>Create looping video</h3>
                      <p className={styles.hint}>
                        Grok combines your face with the default clothes and background, then
                        animates it into a seamless loop.
                      </p>
                      <div className={styles.sourceRow}>
                        <div className={styles.sourcePreviewCol}>
                          <span className={styles.fieldLabel}>1. Your face</span>
                          {pendingSourcePreviewUrl ? (
                            <GalleryMediaPreview
                              key={`face-preview-${activeStageIndex}`}
                              previewKey={`face-preview-${activeStageIndex}`}
                              url={pendingSourcePreviewUrl}
                              alt="Face photo preview"
                            />
                          ) : (
                            <div className={styles.mediaPreviewEmpty}>Upload a face photo →</div>
                          )}
                          <FileDropzone
                            title="Face photo"
                            description="Selfie or portrait — your face only is fine."
                            accept="image/*"
                            file={pendingSourcePhotos[activeStageIndex] ?? null}
                            onFileChange={(file) =>
                              setPendingSourcePhotos((prev) => ({
                                ...prev,
                                [activeStageIndex]: file,
                              }))
                            }
                            onFileRemove={() =>
                              setPendingSourcePhotos((prev) => ({
                                ...prev,
                                [activeStageIndex]: null,
                              }))
                            }
                          />
                        </div>
                        <div className={styles.sourcePreviewCol}>
                          <span className={styles.fieldLabel}>
                            2. Call screen scene (outfit + background)
                            {outfitReferenceSource ? ` (${outfitReferenceSource})` : ""}
                          </span>
                          {outfitReferenceVideoUrl ? (
                            <GalleryMediaPreview
                              key={`outfit-ref-${selectedCharacterId}-${outfitReferenceVideoUrl}`}
                              previewKey={`outfit-ref-${selectedCharacterId}`}
                              url={outfitReferenceVideoUrl}
                              alt={`Call screen scenario video for ${selectedCharacter?.name ?? "character"}`}
                              kind="scenario-video"
                            />
                          ) : outfitReferenceImageUrl ? (
                            <GalleryMediaPreview
                              key={`outfit-ref-${selectedCharacterId}-${outfitReferenceImageUrl}`}
                              previewKey={`outfit-ref-${selectedCharacterId}`}
                              url={outfitReferenceImageUrl}
                              alt={`Call screen scene for ${selectedCharacter?.name ?? "character"}`}
                            />
                          ) : (
                            <div className={styles.mediaPreviewEmpty}>
                              Upload the scenario video in Admin → Influencer → Characters (same
                              video shown on the call screen).
                            </div>
                          )}
                          {outfitReferenceVideoUrl && (
                            <p className={styles.hint}>
                              Grok uses the sharpest frame extracted from this video — not the
                              blurry preview PNG.
                            </p>
                          )}
                          {outfitReferenceSource === "character photo" && (
                            <p className={styles.hint}>
                              Using character photo — upload the call-screen video preview in Admin
                              → Influencer → Characters for the full jail/scenario scene.
                            </p>
                          )}
                        </div>
                      </div>

                      <div className={styles.promptPreviewBox}>
                        <span className={styles.fieldLabel}>
                          Looping motion — {activeStageConfig?.title || `Stage ${activeStageIndex}`}
                        </span>
                        <p className={styles.promptPreview}>
                          {activeLoopingPrompt || "No default looping prompt for this stage."}
                        </p>
                      </div>

                      <button
                        type="button"
                        className={styles.saveButton}
                        onClick={handleGenerate}
                        disabled={generating || !canGenerateLoopingVideo}
                      >
                        {generating
                          ? "Creating looping video..."
                          : "Generate looping video"}
                      </button>
                      {!canGenerateLoopingVideo && !generating && (
                        <p className={styles.hint}>
                          {!pendingSourceFile
                            ? "Upload a face photo to continue."
                            : !hasOutfitReference
                              ? "Upload the call-screen scenario video in Admin → Influencer → Characters."
                              : "Default looping prompt missing for this character stage."}
                        </p>
                      )}

                      <h3 className={styles.sectionTitle}>Approve video</h3>
                      {pendingCandidates.length === 0 ? (
                        <div className={chrome["emptyState"]}>
                          No looping video yet — generate one above.
                        </div>
                      ) : (
                        <div className={styles.variantGrid}>
                          {pendingCandidates.map((candidate) => (
                            <article key={candidate.id} className={styles.variantCard}>
                              <h4 className={styles.variantTitle}>Looping video #{candidate.id}</h4>
                              {candidate.video_url ? (
                                <GalleryMediaPreview
                                  key={`video-${candidate.id}`}
                                  previewKey={candidate.id}
                                  url={candidate.video_url}
                                  alt={`Grok looping video ${candidate.id}`}
                                  kind="video"
                                />
                              ) : candidate.preview_url ? (
                                <GalleryMediaPreview
                                  key={`poster-${candidate.id}`}
                                  previewKey={candidate.id}
                                  url={candidate.preview_url}
                                  alt={`Grok variation ${candidate.id}`}
                                />
                              ) : (
                                <div className={styles.mediaPreviewEmpty}>
                                  {candidate.error_message || "Generation failed"}
                                </div>
                              )}
                              <p className={styles.promptPreview}>{candidate.generation_prompt}</p>
                              <label className={styles.fieldLabel} htmlFor={`slot-${candidate.id}`}>
                                Assign to slot for {selectedCharacter?.name ?? "character"}
                              </label>
                              <div className={styles.approveRow}>
                                <select
                                  id={`slot-${candidate.id}`}
                                  className={styles.characterSelect}
                                  value={approveVariantByCandidate[candidate.id] ?? 1}
                                  onChange={(event) =>
                                    setApproveVariantByCandidate((prev) => ({
                                      ...prev,
                                      [candidate.id]: Number(event.target.value),
                                    }))
                                  }
                                >
                                  {VARIANT_OPTIONS.map((value) => (
                                    <option key={value} value={value}>
                                      Stage slot {value}
                                    </option>
                                  ))}
                                </select>
                                <button
                                  type="button"
                                  className={styles.approveButton}
                                  onClick={() => handleApprove(candidate)}
                                  disabled={
                                    reviewingCandidateId === candidate.id ||
                                    !candidate.has_video
                                  }
                                >
                                  Approve
                                </button>
                                <button
                                  type="button"
                                  className={styles.rejectButton}
                                  onClick={() => handleReject(candidate)}
                                  disabled={reviewingCandidateId === candidate.id}
                                >
                                  Reject
                                </button>
                              </div>
                            </article>
                          ))}
                        </div>
                      )}

                      <h3 className={styles.sectionTitle}>4. Approved variants</h3>
                      <div className={styles.variantGrid}>
                        {activeStage.variants.map((variant) => (
                          <article key={variant.variant_index} className={styles.variantCard}>
                            <div className={styles.variantCardHeader}>
                              <h4 className={styles.variantTitle}>
                                Slot {variant.variant_index}
                                {selectedCharacter ? ` · ${selectedCharacter.name}` : ""}
                              </h4>
                              {(variant.has_mp4 || variant.has_poster) && (
                                <button
                                  type="button"
                                  className={styles.deleteVariantButton}
                                  onClick={() => handleDeleteVariant(variant.variant_index)}
                                  disabled={deletingVariantIndex === variant.variant_index}
                                >
                                  {deletingVariantIndex === variant.variant_index
                                    ? "Removing..."
                                    : "Remove"}
                                </button>
                              )}
                            </div>
                            {variant.video_mp4_url ? (
                              <GalleryMediaPreview
                                key={`variant-video-${activeStageIndex}-${variant.variant_index}`}
                                previewKey={`${activeStageIndex}-${variant.variant_index}-video`}
                                url={variant.video_mp4_url}
                                alt={`${selectedCharacter?.name ?? "Character"} slot ${variant.variant_index}`}
                                kind="video"
                              />
                            ) : variant.poster_url ? (
                              <GalleryMediaPreview
                                key={`variant-poster-${activeStageIndex}-${variant.variant_index}`}
                                previewKey={`${activeStageIndex}-${variant.variant_index}-poster`}
                                url={variant.poster_url}
                                alt={`${selectedCharacter?.name ?? "Character"} slot ${variant.variant_index}`}
                              />
                            ) : (
                              <div className={styles.mediaPreviewEmpty}>Empty slot</div>
                            )}
                            {(variant.tags?.length ?? 0) > 0 ? (
                              <div className={styles.tagList}>
                                {variant.tags.map((tag) => (
                                  <span key={tag} className={styles.tagChipReadonly}>
                                    {tag}
                                  </span>
                                ))}
                              </div>
                            ) : variant.scene_description ? (
                              <p className={styles.promptPreview}>{variant.scene_description}</p>
                            ) : null}
                          </article>
                        ))}
                      </div>
                    </div>
                  </div>
                </>
              )}
            </>
          )}
        </section>
      </AdminTwoColumn>
    </AdminLayout>
  );
};

export default AdminGallery;
