import { Suspense, lazy, useEffect, useRef, useState } from "react";
import { apiClient } from "@/api/apis";
import { InfluencerServices } from "@/api/services/InfluencerService";
import AdultSceneSelector from "@/ui/components/cards/AdultSceneSelectorCard";
import IconButton from "@/ui/components/inputs/buttons/IconButton";
import LoadingSpinner from "@/ui/components/loading/LoadingSpinner";
import styles from "./SceneSelector.module.css";
import SvgPack from "@/utils/SvgPack";
import useAdultCallTransport from "@/hooks/useAdultCallTransport";
import { formatTime } from "@/utils/time";
import { showErrorModal } from "@/utils/errorModal";
import AddCreditsModal from "@/ui/components/modals/payment-modal/AddCreditsModal";
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

type SceneSelectorProps = {
  influencerId: string;
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

export default function SceneSelector({ influencerId, onGirlfriendModeSelected }: SceneSelectorProps) {
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [selectedScene, setSelectedScene] = useState<Scene | null>(null);
  const [sessionState, setSessionState] = useState<SessionState>("preview");
  const [isLoading, setIsLoading] = useState(true);
  const [loadErrorMessage, setLoadErrorMessage] = useState<string | null>(null);
  const [showTopupModal, setShowTopupModal] = useState(false);
  const [pendingScene, setPendingScene] = useState<Scene | null>(null);
  const { needsGate, verificationRequired, markConfirmed } = useAgeVerification();
  const lastCallErrorRef = useRef<string | null>(null);
  const {
    startCall,
    stopCall,
    status,
    elapsedSeconds,
    activeStatusLabel,
    isCallActive,
    postCallSummary,
    pendingSummaryRefresh,
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
      return;
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
      setPendingScene(scene);
      return;
    }
    setSelectedScene(scene);
    setSessionState("preview");
  };

  const handleAgeConfirmed = () => {
    markConfirmed();
    if (pendingScene) {
      setSelectedScene(pendingScene);
      setSessionState("preview");
      setPendingScene(null);
    }
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
      ) : !selectedScene ? (
        <div className={styles.page1}>
          <div className={styles.header}>Select a scenario</div>
          <div className={styles.selectionArea}>
            <div
              className={`${styles.scenesList} ${scenes.length > 1 ? styles.edgeFade : ""}`}
            >
              {scenes.filter((scene) => RELATIONSHIP_MODE_AVAILABLE || scene.slug !== "relationship").map((scene) => (
                <div key={scene.id} className={`${styles.sceneItem}${scene.slug === "relationship" ? ` ${styles.relationshipSceneItem}` : ""}`}>
                  <AdultSceneSelector
                    name={scene.name}
                    description={scene.description}
                    imageSmallSrc={scene.image.small}
                    imageLargeSrc={scene.image.large}
                    titlePlaceholder={scene.titlePlaceholder}
                    isRelationship={scene.slug === "relationship"}
                    samples={scene.samples}
                    ageVerified={!needsGate && !verificationRequired}
                    onLockedClick={() => setPendingScene(scene)}
                  />
                  <IconButton
                    onClick={() => handleSelectScenario(scene)}
                    text="Select Scenario"
                    color="purple-glass"
                    type="pill"
                    className={styles.sceneButton}
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div
          className={`${styles.sessionPage} ${sessionState === "preview" ? styles.previewSessionPage : styles.activeSessionPage}`}
        >
          <div
            className={`${styles.sessionStage} ${sessionState === "preview" ? styles.previewStage : styles.activeStage}`}
          >
            <IconButton
              type="pill"
              color="black"
              leftIcon={
                <Suspense fallback={null}>
                  <SvgPack.CloseSquare className={styles.previewCloseIcon} />
                </Suspense>
              }
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
                    <>
                      <div className={styles.subtitle}>
                        {pendingSummaryRefresh ? "Preparing call summary..." : "Call summary"}
                      </div>
                      <div className={styles.postCallSummary}>
                        <div className={styles.postCallSummaryCard}>
                          <span className={styles.postCallSummaryLabel}>Duration</span>
                          <span className={styles.postCallSummaryValue}>
                            {summaryDurationLabel}
                          </span>
                        </div>
                        <div className={styles.postCallSummaryCard}>
                          <span className={styles.postCallSummaryLabel}>Cost</span>
                          <span className={styles.postCallSummaryValue}>
                            {summaryCostLabel}
                          </span>
                        </div>
                      </div>
                      {pendingSummaryRefresh && (
                        <div className={styles.postCallSummaryHint}>
                          Estimated values shown while we confirm the final summary.
                        </div>
                      )}
                      {!pendingSummaryRefresh && (
                        <div className={styles.activeActions}>
                          <IconButton
                            onClick={handleStartCall}
                            color="green"
                            type="pill"
                            className={styles.activeCallButton}
                            disabled={isStartDisabled}
                            leftIcon={
                              <Suspense fallback={null}>
                                <SvgPack.Call className={styles.callButtonIcon} />
                              </Suspense>
                            }
                          />
                        </div>
                      )}
                    </>
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
      <AddCreditsModal
        isOpen={showTopupModal}
        influencerId={influencerId}
        onClose={() => setShowTopupModal(false)}
      />
      {pendingScene && (
        <Suspense fallback={null}>
          <AdultTermsModal
            isOpen
            onClose={() => setPendingScene(null)}
            onAgree={handleAgeConfirmed}
            influencerId={influencerId}
            idVerificationRequired={verificationRequired}
          />
        </Suspense>
      )}
    </div>
  );
}
