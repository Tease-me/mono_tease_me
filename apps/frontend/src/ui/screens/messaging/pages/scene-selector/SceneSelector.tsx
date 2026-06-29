import { Suspense, lazy, useContext, useEffect, useMemo, useRef, useState } from "react";
import avatarFallback from "@/assets/empty-profile.png";
import { AuthContext } from "@/context/AuthContext";
import { apiClient } from "@/api/apis";
import { InfluencerServices } from "@/api/services/InfluencerService";
import AdultSceneSelector from "@/ui/components/cards/AdultSceneSelectorCard";
import IconButton from "@/ui/components/inputs/buttons/IconButton";
import CloseIconButton from "@/ui/components/inputs/buttons/CloseIconButton";
import LoadingSpinner from "@/ui/components/loading/LoadingSpinner";
import styles from "./SceneSelector.module.css";
import SvgPack from "@/utils/SvgPack";
import useAdultCallTransport from "@/hooks/useAdultCallTransport";
import { formatTime } from "@/utils/time";
import { showErrorModal } from "@/utils/errorModal";
import AddCreditsModal from "@/ui/components/modals/payment-modal/AddCreditsModal";
import { Modal } from "@/ui/components/modals/Modal";
import { useAgeVerification } from "@/hooks/useAgeVerification";
import { RELATIONSHIP_MODE_AVAILABLE } from "@/constants/featureFlags";
import CreditDisplay from "@/ui/components/stats/CreditDisplay";
import CrossfadeLoopVideo from "./CrossfadeLoopVideo";
import SceneSwipeDeck from "./SceneSwipeDeck";
import { useIsMobile } from "@/hooks/layout/useIsDesktop";

const AdultTermsModal = lazy(() => import("@/ui/components/modals/adult-terms/AdultTermsModal"));

export type SceneTitlePlaceholder =
  | { type: "json"; data: unknown }
  | { type: "lottie"; src: string }
  | null;

type Scene = {
  id: number;
  slug: string;
  name: string;
  description: string;
  scenarioDetails: string;
  titlePlaceholder: SceneTitlePlaceholder;
  image: {
    small: string | null;
    large: string | null;
  };
  video: {
    image: string | null;
    mp4: string | null;
    webm: string | null;
  };
  samples: {
    normal: string[];
    explicit: string[];
  };
};

type SessionState = "preview" | "active";
type PendingGateAction = "open-scene" | "unlock-samples";

type SceneSelectorProps = {
  influencerId: string;
  influencerName?: string;
  influencerImageUrl?: string;
  influencerVideoUrl?: string;
  onGirlfriendModeSelected: () => void;
  onListViewChange?: (isListView: boolean) => void;
};

const influencerServices = InfluencerServices(apiClient);
const lottieDataCache = new Map<string, Promise<SceneTitlePlaceholder>>();

const parseSampleUrls = (metaJson: Record<string, unknown> | null): { normal: string[]; explicit: string[] } => {
  const raw = metaJson?.samples as { normal?: unknown[]; explicit?: unknown[] } | undefined;
  const pluck = (list: unknown[] | undefined) =>
    (list ?? []).map((s: any) => s?.url as string | undefined).filter((u): u is string => Boolean(u));
  return { normal: pluck(raw?.normal), explicit: pluck(raw?.explicit) };
};

const loadLottieData = async (url: string): Promise<SceneTitlePlaceholder> => {
  const cached = lottieDataCache.get(url);
  if (cached) {
    return cached;
  }

  const detectPlaceholder = async (response: Response): Promise<SceneTitlePlaceholder> => {
    const buffer = await response.arrayBuffer();
    const bytes = new Uint8Array(buffer.slice(0, 8));
    if (bytes[0] === 0x50 && bytes[1] === 0x4b) {
      return { type: "lottie", src: url };
    }

    const text = new TextDecoder("utf-8").decode(buffer);
    const trimmed = text.trim();
    if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
      return { type: "json", data: JSON.parse(text) };
    }

    const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
    if (
      contentType.includes("application/zip") ||
      contentType.includes("application/octet-stream") ||
      contentType.includes("application/x-zip") ||
      contentType.includes("application/x-zip-compressed") ||
      contentType.includes("application/vnd.lottie")
    ) {
      return { type: "lottie", src: url };
    }

    return null;
  };

  const request = fetch(url)
    .then(async (response) => {
      if (!response.ok) {
        return null;
      }
      return await detectPlaceholder(response);
    })
    .catch(() => {
      lottieDataCache.delete(url);
      return null;
    });

  lottieDataCache.set(url, request);
  return request;
};

export default function SceneSelector({
  influencerId,
  influencerName,
  influencerImageUrl,
  influencerVideoUrl,
  onGirlfriendModeSelected,
  onListViewChange,
}: SceneSelectorProps) {
  const { user } = useContext(AuthContext);
  const isMobile = useIsMobile();
  const scenesListRef = useRef<HTMLDivElement | null>(null);
  const deckRef = useRef<HTMLDivElement | null>(null);
  const lastSceneListScrollLeftRef = useRef(0);
  const lastSelectedSceneIdRef = useRef<number | null>(null);
  const [mobileSceneIndex, setMobileSceneIndex] = useState(0);
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [selectedScene, setSelectedScene] = useState<Scene | null>(null);
  const [sessionState, setSessionState] = useState<SessionState>("preview");
  const [isLoading, setIsLoading] = useState(true);
  const [loadErrorMessage, setLoadErrorMessage] = useState<string | null>(null);
  const [showTopupModal, setShowTopupModal] = useState(false);
  const [pendingGate, setPendingGate] = useState<{
    scene: Scene;
    action: PendingGateAction;
  } | null>(null);
  const [showSummaryInfoModal, setShowSummaryInfoModal] = useState(false);
  const { needsGate, verificationRequired, markConfirmed } = useAgeVerification();
  const lastCallErrorRef = useRef<string | null>(null);
  const {
    startCall,
    stopCall,
    dismissPostCallSummary,
    status,
    elapsedSeconds,
    activeStatusLabel,
    isCallActive,
    postCallSummary,
    showPostCallSummary,
    activeScene,
    isStartDisabled,
    error: callError,
  } = useAdultCallTransport({
    onInsufficientCredits: () => {
      setShowTopupModal(true);
    },
  });

  useEffect(() => {
    setSelectedScene(null);
    setSessionState("preview");
    setIsLoading(true);
    setLoadErrorMessage(null);
    setMobileSceneIndex(0);
  }, [influencerId]);

  const visibleScenes = useMemo(
    () => scenes.filter((scene) => RELATIONSHIP_MODE_AVAILABLE || scene.slug !== "relationship"),
    [scenes],
  );

  const showMobileDeck = isMobile && visibleScenes.length > 1;

  useEffect(() => {
    setMobileSceneIndex((currentIndex) =>
      Math.min(currentIndex, Math.max(visibleScenes.length - 1, 0)),
    );
  }, [visibleScenes.length]);

  useEffect(() => {
    if (!showMobileDeck || !deckRef.current) {
      return;
    }

    deckRef.current
      .querySelectorAll<HTMLAudioElement>("audio")
      .forEach((audio) => {
        audio.pause();
        audio.currentTime = 0;
      });
  }, [mobileSceneIndex, showMobileDeck]);

  useEffect(() => {
    if (!selectedScene) {
      requestAnimationFrame(() => {
        const targetSceneId = lastSelectedSceneIdRef.current;
        if (targetSceneId != null) {
          const targetIndex = visibleScenes.findIndex((scene) => scene.id === targetSceneId);
          if (targetIndex >= 0 && showMobileDeck) {
            setMobileSceneIndex(targetIndex);
            return;
          }

          if (scenesListRef.current) {
            const targetCard = scenesListRef.current.querySelector<HTMLElement>(
              `[data-scene-id="${targetSceneId}"]`,
            );
            if (targetCard) {
              targetCard.scrollIntoView({
                block: "nearest",
                inline: "center",
              });
              return;
            }
          }
        }

        if (scenesListRef.current) {
          scenesListRef.current.scrollLeft = lastSceneListScrollLeftRef.current;
        }
      });
      return;
    }

    const activeContainer = showMobileDeck ? deckRef.current : scenesListRef.current;
    if (activeContainer) {
      lastSelectedSceneIdRef.current = selectedScene.id;
      if (scenesListRef.current) {
        lastSceneListScrollLeftRef.current = scenesListRef.current.scrollLeft;
      }
      activeContainer
        .querySelectorAll<HTMLAudioElement>("audio")
        .forEach((audio) => {
          audio.pause();
          audio.currentTime = 0;
        });
    }

    setSessionState(isCallActive || showPostCallSummary ? "active" : "preview");
  }, [isCallActive, selectedScene, showMobileDeck, showPostCallSummary, visibleScenes]);

  useEffect(() => {
    onListViewChange?.(!selectedScene);
  }, [onListViewChange, selectedScene]);

  useEffect(() => {
    if (status !== "error") {
      lastCallErrorRef.current = null;
      return;
    }

    if (callError?.code === "INSUFFICIENT_CREDITS") {
      return;
    }

    const nextMessage = callError?.message || "Unable to start the call right now.";
    if (lastCallErrorRef.current === nextMessage) {
      return;
    }

    lastCallErrorRef.current = nextMessage;
    showErrorModal({
      title: "Call Error",
      message: nextMessage,
    });
  }, [callError, status]);

  useEffect(() => {
    if (!influencerId) {
      setScenes([]);
      setIsLoading(false);
      setLoadErrorMessage(null);
      return;
    }

    let cancelled = false;
    setIsLoading(true);
    setLoadErrorMessage(null);

    void (async () => {
      try {
        const response = await influencerServices.getAdultCharacters(influencerId);
        const activeCharacters = response
          .filter((character) => character.is_active)
          .sort((a, b) => a.display_order - b.display_order);

        const nextScenes = await Promise.all(
          activeCharacters.map(async (character) => {
            const titlePlaceholder = character.lottie_text_url
              ? await loadLottieData(character.lottie_text_url)
              : null;

            return {
              id: character.id,
              slug: character.slug,
              name: character.name,
              description:
                character.short_description ?? character.description ?? "",
              scenarioDetails:
                character.description ?? character.short_description ?? "",
              titlePlaceholder,
              image: {
                small:
                  character.photo_url ?? character.default_artwork_url ?? null,
                large:
                  character.photo_2x_url ??
                  character.photo_url ??
                  character.default_artwork_url ??
                  null,
              },
              video: {
                image:
                  character.video_preview_png_url ??
                  character.default_artwork_url ??
                  null,
                mp4: character.video_mp4_url,
                webm: character.video_webm_url,
              },
              samples: parseSampleUrls(character.meta_json),
            } satisfies Scene;
          }),
        );

        if (!cancelled) {
          setScenes(nextScenes);
        }
      } catch {
        if (!cancelled) {
          setScenes([]);
          setLoadErrorMessage("Unable to load scenarios right now.");
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [influencerId]);

  const handleSelectScenario = (scene: Scene) => {
    if (scene.slug !== "relationship" && needsGate) {
      setPendingGate({ scene, action: "open-scene" });
      return;
    }
    lastSelectedSceneIdRef.current = scene.id;
    setSelectedScene(scene);
    setSessionState("preview");
  };

  const handleAgeConfirmed = () => {
    markConfirmed();
    if (pendingGate?.action === "open-scene") {
      lastSelectedSceneIdRef.current = pendingGate.scene.id;
      setSelectedScene(pendingGate.scene);
      setSessionState("preview");
    }
    setPendingGate(null);
  };

  const handleCloseScenario = () => {
    setSelectedScene(null);
  };

  const handleStartCall = async () => {
    if (!selectedScene) {
      return;
    }
    await startCall({
      influencerId,
      characterId: selectedScene.id,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    });
  };

  const handleEndCall = async () => {
    await stopCall();
  };

  const handleBackToSceneSelection = () => {
    dismissPostCallSummary();
    handleCloseScenario();
  };

  const isRelationshipScene = selectedScene?.slug === "relationship";

  const displayScene = isCallActive ? activeScene : null;
  const useStageMedia = Boolean(
    displayScene?.video_mp4_url || displayScene?.video_webm_url,
  );

  const liveVideoMp4 = useStageMedia
    ? displayScene?.video_mp4_url ?? null
    : selectedScene?.video.mp4 ?? null;
  const liveVideoWebm = useStageMedia
    ? displayScene?.video_webm_url ?? null
    : selectedScene?.video.webm ?? null;
  const liveVideoPoster = useStageMedia
    ? displayScene?.poster_url ?? selectedScene?.video.image ?? null
    : selectedScene?.video.image ?? null;

  const loopVideoSource = useMemo(
    () => ({
      key: displayScene
        ? (() => {
            const assetUrl =
              displayScene.video_mp4_url ?? displayScene.video_webm_url ?? "";
            const assetId =
              assetUrl.split("?")[0]?.split("/").pop() ?? "none";
            const tagSlug = displayScene.stage_tag ?? `stage-${displayScene.stage_index}`;
            return `${tagSlug}-${displayScene.variant_index}-${assetId}`;
          })()
        : `preview-${selectedScene?.id ?? "none"}`,
      mp4: liveVideoMp4,
      webm: liveVideoWebm,
      poster: liveVideoPoster,
    }),
    [
      displayScene,
      liveVideoMp4,
      liveVideoPoster,
      liveVideoWebm,
      selectedScene?.id,
    ],
  );

  const showVideo = Boolean(liveVideoWebm) || Boolean(liveVideoMp4);

  const hasConfirmedSummary =
    postCallSummary?.confirmedDurationSeconds != null &&
    postCallSummary?.confirmedCostCredits != null;
  const confirmedDurationSeconds = hasConfirmedSummary
    ? postCallSummary.confirmedDurationSeconds
    : null;
  const confirmedCostCredits = hasConfirmedSummary
    ? postCallSummary.confirmedCostCredits
    : null;

  const summaryDurationLabel = confirmedDurationSeconds != null
    ? formatTime(Math.max(0, Math.round(confirmedDurationSeconds)))
    : null;

  const isWaitingForConfirmedSummary =
    showPostCallSummary &&
    !hasConfirmedSummary;

  const selectedSceneAvatar =
    selectedScene?.image.small ??
    influencerImageUrl ??
    avatarFallback;

  const renderSceneSelector = (scene: Scene, options?: { preview?: boolean; opaque?: boolean }) => (
    <AdultSceneSelector
      name={scene.name}
      description={scene.description}
      imageSmallSrc={scene.image.small}
      imageLargeSrc={scene.image.large}
      titlePlaceholder={scene.titlePlaceholder}
      isRelationship={scene.slug === "relationship"}
      samples={scene.samples}
      ageVerified={!needsGate && !verificationRequired}
      onLockedClick={() => setPendingGate({ scene, action: "unlock-samples" })}
      preview={options?.preview}
      opaque={options?.opaque}
    />
  );

  const renderSceneCard = (scene: Scene, options?: { under?: boolean; inDeck?: boolean; stack?: boolean }) => (
    <div
      key={scene.id}
      data-scene-id={scene.id}
      className={`${styles.sceneItem}${options?.inDeck ? ` ${styles.deckSceneItem}` : ""}${options?.stack ? ` ${styles.deckStackItem}` : ""}${scene.slug === "relationship" ? ` ${styles.relationshipSceneItem}` : ""}`}
    >
      {renderSceneSelector(scene, {
        opaque: true,
        preview: options?.stack,
      })}
      {!options?.under ? (
        <IconButton
          onClick={scene.slug === "vibrator" ? undefined : () => handleSelectScenario(scene)}
          text={scene.slug === "vibrator" ? "Coming Soon" : "Select Scenario"}
          color="purple-glass"
          type="pill"
          disabled={scene.slug === "vibrator"}
          className={styles.sceneButton}
        />
      ) : null}
    </div>
  );

  return (
    <div className={styles.container}>
      {isLoading ? (
        <div className={styles.loadingState}>
          <LoadingSpinner size="medium" />
        </div>
      ) : loadErrorMessage ? (
        <div className={styles.statusState}>
          <div className={styles.statusText}>{loadErrorMessage}</div>
        </div>
      ) : scenes.length === 0 ? (
        <div className={styles.statusState}>
          <div className={styles.statusText}>No scenarios available yet.</div>
        </div>
      ) : (
        <>
          <div className={`${styles.page1}${selectedScene ? ` ${styles.page1Hidden}` : ""}`}>
            {showMobileDeck ? (
              <SceneSwipeDeck
                deckRef={deckRef}
                items={visibleScenes}
                index={mobileSceneIndex}
                onIndexChange={setMobileSceneIndex}
                renderCard={(scene) => renderSceneCard(scene, { inDeck: true })}
                renderUnderCard={(scene) => renderSceneCard(scene, { under: true, inDeck: true })}
              />
            ) : (
              <div className={styles.selectionArea}>
                <div
                  ref={scenesListRef}
                  className={`${styles.scenesList} ${visibleScenes.length > 1 ? styles.edgeFade : ""}`}
                >
                  {visibleScenes.map((scene) => renderSceneCard(scene))}
                </div>
              </div>
            )}
          </div>
          {selectedScene && (
            <div
              className={`${styles.sessionPage} ${sessionState === "preview" ? styles.previewSessionPage : styles.activeSessionPage}`}
            >
              <div
                className={`${styles.sessionStage} ${sessionState === "preview" ? styles.previewStage : styles.activeStage}`}
              >
                <CloseIconButton
                  onClick={handleCloseScenario}
                  className={`${styles.previewCloseButton} ${sessionState === "preview" ? styles.previewCloseButtonVisible : styles.previewCloseButtonHidden}`}
                />
                <div className={styles.sessionMedia}>
                  {showVideo ? (
                    <CrossfadeLoopVideo
                      source={loopVideoSource}
                      videoClassName={`${styles.sessionVideo} ${sessionState === "preview" ? styles.previewVideo : styles.activeVideo}`}
                    />
                  ) : liveVideoPoster ? (
                    <img
                      src={liveVideoPoster}
                      alt={selectedScene.name}
                      className={`${styles.sessionVideo} ${sessionState === "preview" ? styles.previewVideo : styles.activeVideo}`}
                    />
                  ) : null}

                  {sessionState === "preview" && <div className={styles.previewOverlay} />}
                  {showPostCallSummary && <div className={styles.postCallOverlay} />}
                  <div className={`${styles.sessionName} ${sessionState === "preview" ? styles.previewContentVisible : styles.previewContentHidden}`}>{selectedScene.name}</div>
                  <div className={`${styles.previewPanel} ${sessionState === "preview" ? styles.previewContentVisible : styles.previewContentHidden}`}>
                    <div className={styles.subtitle}>Scenario Details</div>
                    <div className={styles.sessionDescription}>
                      {selectedScene.scenarioDetails}
                    </div>
                    <div className={styles.previewActions}>
                      {isRelationshipScene ? (
                        <IconButton
                          onClick={onGirlfriendModeSelected}
                          color="black"
                          type="pill"
                          className={styles.callButton}
                          text="Start Girlfriend Mode"
                          leftIcon={
                            <Suspense fallback={null}>
                              <SvgPack.HeartBold className={styles.callButtonIcon} />
                            </Suspense>
                          }
                        />
                      ) : (
                        <IconButton
                          onClick={handleStartCall}
                          color="green"
                          type="pill"
                          className={styles.callButton}
                          disabled={isStartDisabled}
                          leftIcon={
                            <Suspense fallback={null}>
                              <SvgPack.Call className={styles.callButtonIcon} />
                            </Suspense>
                          }
                        />
                      )}
                    </div>
                  </div>
                  {!isRelationshipScene && (
                    <div
                      className={`${styles.activePanel} ${sessionState === "active" ? styles.activePanelVisible : styles.activePanelHidden}`}
                    >
                      {showPostCallSummary ? (
                        <div className={styles.summaryContent}>
                          <div className={styles.summaryAvatars}>
                            <img src={user?.imgUrl || avatarFallback} alt="You" className={styles.summaryUserAvatar} />
                            <IconButton
                              color="red"
                              type="pill"
                              className={styles.summaryEndCallBadge}
                              leftIcon={
                                <Suspense fallback={null}>
                                  <SvgPack.HangupCallIcon />
                                </Suspense>
                              }
                            />
                            <img src={selectedSceneAvatar} alt={selectedScene?.name || "Influencer"} className={styles.summaryInfluencerAvatar} />
                          </div>
                          <div className={styles.subtitle}>Call Summary</div>
                          {isWaitingForConfirmedSummary && (
                            <div className={styles.summaryProcessingCopy}>
                              <span>Finalizing call summary...</span>
                            </div>
                          )}
                          {hasConfirmedSummary && (
                            <>
                              <div className={styles.sessionTimer}>{summaryDurationLabel}</div>
                              <div className={styles.summaryCostRow}>
                                <span className={styles.summaryCostLabel}>
                                  Cost:{" "}
                                  {confirmedCostCredits != null ? (
                                    <CreditDisplay credits={confirmedCostCredits} />
                                  ) : (
                                    "--"
                                  )}
                                </span>
                                <button
                                  type="button"
                                  className={styles.summaryInfoButton}
                                  onClick={() => setShowSummaryInfoModal(true)}
                                  aria-label="How is this summary updated?"
                                >
                                  <Suspense fallback={null}>
                                    <SvgPack.InfoCircleGray />
                                  </Suspense>
                                </button>
                              </div>
                            </>
                          )}
                          <IconButton
                            onClick={handleBackToSceneSelection}
                            color="black"
                            type="pill"
                            className={styles.summaryGoBackButton}
                            text="Go Back"
                          />
                          <a
                            href="mailto:support@teaseme.live"
                            className={styles.summaryFeedbackLink}
                          >
                            Send feedback
                          </a>
                        </div>
                      ) : (
                        <>
                          <div className={styles.subtitle}>
                            {displayScene?.title ?? activeStatusLabel}
                          </div>
                          {displayScene?.description && (
                            <div className={styles.sessionDescription}>
                              {displayScene.description}
                            </div>
                          )}
                          <div className={styles.sessionTimer}>
                            {formatTime(elapsedSeconds)}
                          </div>
                          <div className={styles.activeActions}>
                            <IconButton
                              onClick={handleEndCall}
                              color="red"
                              type="pill"
                              className={styles.activeCallButton}
                              leftIcon={
                                <Suspense fallback={null}>
                                  <SvgPack.HangupCallIcon />
                                </Suspense>
                              }
                            />
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </div>
                <div
                  className={`${styles.previewDesktopPanel} ${sessionState === "preview" ? styles.previewDesktopPanelVisible : styles.previewDesktopPanelHidden}`}
                >
                  <div className={styles.desktopSessionName}>{selectedScene.name}</div>
                  <div className={styles.previewDesktopBody}>
                    <div className={styles.subtitle}>Scenario Details</div>
                    <div className={styles.sessionDescription}>
                      {selectedScene.scenarioDetails}
                    </div>
                    <div className={styles.previewActions}>
                      {isRelationshipScene ? (
                        <IconButton
                          onClick={onGirlfriendModeSelected}
                          color="black"
                          type="pill"
                          className={styles.callButton}
                          text="Start Girlfriend Mode"
                          leftIcon={
                            <Suspense fallback={null}>
                              <SvgPack.HeartBold className={styles.callButtonIcon} />
                            </Suspense>
                          }
                        />
                      ) : (
                        <IconButton
                          onClick={handleStartCall}
                          color="green"
                          type="pill"
                          className={styles.callButton}
                          disabled={isStartDisabled}
                          leftIcon={
                            <Suspense fallback={null}>
                              <SvgPack.Call className={styles.callButtonIcon} />
                            </Suspense>
                          }
                        />
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      )}
      <AddCreditsModal
        isOpen={showTopupModal}
        influencerId={influencerId}
        influencerName={influencerName}
        image={influencerImageUrl}
        video={influencerVideoUrl}
        onClose={() => setShowTopupModal(false)}
      />
      {pendingGate && (
        <Suspense fallback={null}>
          <AdultTermsModal
            isOpen
            onClose={() => setPendingGate(null)}
            onAgree={handleAgeConfirmed}
            influencerId={influencerId}
            idVerificationRequired={verificationRequired}
          />
        </Suspense>
      )}
      {showSummaryInfoModal && (
        <Modal
          isOpen
          onClose={() => setShowSummaryInfoModal(false)}
          className={styles.summaryInfoModal}
          ariaLabel="How is this summary updated?"
        >
          <div className={styles.summaryInfoModalCard}>
            <h3 className={styles.summaryInfoHeading}>How are call costs calculated?</h3>
            <p className={styles.summaryInfoSubtitle}>
              Standard call charge 60–78 credits per minute
            </p>
            <div className={styles.summaryInfoNote}>
              <p className={styles.summaryInfoNoteTitle}>Notes on Call Charges</p>
              <p className={styles.summaryInfoNoteText}>
                The total duration of the connection.<br></br> Includes the time it takes to establish the connection and is usually longer than the conversation.
              </p>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
