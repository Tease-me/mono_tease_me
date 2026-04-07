import { Suspense, lazy, useContext, useEffect, useRef, useState } from "react";
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
  onGirlfriendModeSelected: () => void;
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
  onGirlfriendModeSelected,
}: SceneSelectorProps) {
  const { user } = useContext(AuthContext);
  const scenesListRef = useRef<HTMLDivElement | null>(null);
  const lastSceneListScrollLeftRef = useRef(0);
  const lastSelectedSceneIdRef = useRef<number | null>(null);
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
  }, [influencerId]);

  useEffect(() => {
    if (!selectedScene) {
      requestAnimationFrame(() => {
        if (scenesListRef.current) {
          const targetSceneId = lastSelectedSceneIdRef.current;
          if (targetSceneId != null) {
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
          scenesListRef.current.scrollLeft = lastSceneListScrollLeftRef.current;
        }
      });
      return;
    }

    if (scenesListRef.current) {
      lastSelectedSceneIdRef.current = selectedScene.id;
      lastSceneListScrollLeftRef.current = scenesListRef.current.scrollLeft;
      scenesListRef.current
        .querySelectorAll<HTMLAudioElement>("audio")
        .forEach((audio) => {
          audio.pause();
          audio.currentTime = 0;
        });
    }

    setSessionState(isCallActive || showPostCallSummary ? "active" : "preview");
  }, [isCallActive, selectedScene, showPostCallSummary]);

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

  const showVideo =
    Boolean(selectedScene?.video.webm) || Boolean(selectedScene?.video.mp4);

  const summaryDurationLabel = (() => {
    const seconds =
      postCallSummary?.confirmedDurationSeconds ??
      postCallSummary?.estimatedDurationSeconds ??
      null;
    return seconds == null ? "--" : formatTime(Math.max(0, Math.round(seconds)));
  })();

  const summaryCostLabel = (() => {
    const costCents =
      postCallSummary?.confirmedCostCents ??
      postCallSummary?.estimatedCostCents ??
      null;
    return costCents == null ? "--" : `$${(costCents / 100).toFixed(2)}`;
  })();

  const selectedSceneAvatar =
    selectedScene?.image.small ??
    influencerImageUrl ??
    avatarFallback;

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
            <div className={styles.header}>Select a scenario</div>
            <div className={styles.selectionArea}>
              <div
                ref={scenesListRef}
                className={`${styles.scenesList} ${scenes.length > 1 ? styles.edgeFade : ""}`}
              >
                {scenes.filter((scene) => RELATIONSHIP_MODE_AVAILABLE || scene.slug !== "relationship").map((scene) => (
                  <div
                    key={scene.id}
                    data-scene-id={scene.id}
                    className={`${styles.sceneItem}${scene.slug === "relationship" ? ` ${styles.relationshipSceneItem}` : ""}`}
                  >
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
                    />
                    <IconButton
                      onClick={scene.slug === "vibrator" ? undefined : () => handleSelectScenario(scene)}
                      text={scene.slug === "vibrator" ? "Coming Soon" : "Select Scenario"}
                      color="purple-glass"
                      type="pill"
                      disabled={scene.slug === "vibrator"}
                      className={styles.sceneButton}
                    />
                  </div>
                ))}
              </div>
            </div>
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
                    <video
                      poster={selectedScene.video.image ?? undefined}
                      className={`${styles.sessionVideo} ${sessionState === "preview" ? styles.previewVideo : styles.activeVideo}`}
                      autoPlay
                      loop
                      muted
                      playsInline
                    >
                      {selectedScene.video.webm && (
                        <source src={selectedScene.video.webm} type="video/webm" />
                      )}
                      {selectedScene.video.mp4 && (
                        <source src={selectedScene.video.mp4} type="video/mp4" />
                      )}
                      Your browser does not support the video tag.
                    </video>
                  ) : selectedScene.video.image ? (
                    <img
                      src={selectedScene.video.image}
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
                          <div className={styles.sessionTimer}>{summaryDurationLabel}</div>
                          <div className={styles.summaryCostRow}>
                            <span className={styles.summaryCostLabel}>Est. Cost: {summaryCostLabel}</span>
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
                          <div className={styles.subtitle}>{activeStatusLabel}</div>
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
        image={selectedSceneAvatar}
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
            <h3 className={styles.summaryInfoHeading}>How is this summary updated?</h3>
            <p className={styles.summaryInfoSubtitle}>
              Duration and cost are shown immediately after the call ends.
            </p>
            <div className={styles.summaryInfoNote}>
              <p className={styles.summaryInfoNoteTitle}>Why values may change</p>
              <p className={styles.summaryInfoNoteText}>
                The first values can be estimated locally, then replaced with backend-confirmed values once the call summary finishes processing.
              </p>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
