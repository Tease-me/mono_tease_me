import { Suspense, lazy, useEffect, useMemo, useRef, useState } from "react";
import { apiClient } from "@/api/apis";
import { InfluencerServices } from "@/api/services/InfluencerService";
import AdultSceneSelector from "@/ui/components/cards/AdultSceneSelectorCard";
import IconButton from "@/ui/components/inputs/buttons/IconButton";
import LoadingSpinner from "@/ui/components/loading/LoadingSpinner";
import styles from "./SceneSelector.module.css";
import SvgPack from "@/utils/SvgPack";
import useCallWebRTC from "@/hooks/useCallWebRTC";
import { formatTime } from "@/utils/time";
import { showErrorModal } from "@/utils/errorModal";
import AddCreditsModal from "@/ui/components/modals/payment-modal/AddCreditsModal";
import { useAgeVerification } from "@/hooks/useAgeVerification";

const AdultTermsModal = lazy(() => import("@/ui/components/modals/adult-terms/AdultTermsModal"));

type Scene = {
  id: number;
  slug: string;
  name: string;
  description: string;
  scenarioDetails: string;
  titlePlaceholderData: unknown | null;
  image: {
    small: string | null;
    large: string | null;
  };
  video: {
    image: string | null;
    mp4: string | null;
    webm: string | null;
  };
};

type SessionState = "preview" | "active";

type SceneSelectorProps = {
  influencerId: string;
  onGirlfriendModeSelected: () => void;
};

const influencerServices = InfluencerServices(apiClient);
const lottieDataCache = new Map<string, Promise<unknown | null>>();

const loadLottieData = async (url: string): Promise<unknown | null> => {
  const cached = lottieDataCache.get(url);
  if (cached) {
    return cached;
  }

  const request = fetch(url)
    .then(async (response) => {
      if (!response.ok) {
        return null;
      }
      return (await response.json()) as unknown;
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
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showCallTime, setShowCallTime] = useState(0);
  const [showTopupModal, setShowTopupModal] = useState(false);
  const [pendingScene, setPendingScene] = useState<Scene | null>(null);
  const { needsGate, verificationRequired, markConfirmed } = useAgeVerification();
  const lastCallErrorRef = useRef<string | null>(null);
  const isCreditsErrorRef = useRef(false);
  const { setInfluencerId, startConversation, stopConversation, status } =
    useCallWebRTC({ onCreditsExpired: () => { isCreditsErrorRef.current = true; setShowTopupModal(true); } });
  const isCallActive = status === "connecting" || status === "connected";
  const activeStatusLabel = useMemo(() => {
    if (status === "connecting") {
      return "Ringing";
    }
    if (status === "connected") {
      return "Connected";
    }
    return "";
  }, [status]);

  useEffect(() => {
    setSelectedScene(null);
    setSessionState("preview");
    setIsLoading(true);
    setErrorMessage(null);
  }, [influencerId]);

  useEffect(() => {
    setInfluencerId(influencerId);
  }, [influencerId, setInfluencerId]);

  useEffect(() => {
    const isActive = status === "connecting" || status === "connected";

    if (!isActive) {
      setShowCallTime(0);
      return;
    }

    const interval = setInterval(() => {
      setShowCallTime((prev) => prev + 1);
    }, 1000);

    return () => clearInterval(interval);
  }, [status]);

  useEffect(() => {
    if (!selectedScene) {
      return;
    }

    setSessionState(isCallActive ? "active" : "preview");
  }, [isCallActive, selectedScene]);

  useEffect(() => {
    if (status !== "error") {
      lastCallErrorRef.current = null;
      isCreditsErrorRef.current = false;
      return;
    }

    if (isCreditsErrorRef.current) {
      return;
    }

    const nextMessage = errorMessage || "Unable to start the call right now.";
    if (lastCallErrorRef.current === nextMessage) {
      return;
    }

    lastCallErrorRef.current = nextMessage;
    showErrorModal({
      title: "Call Error",
      message: nextMessage,
    });
  }, [errorMessage, status]);

  useEffect(() => {
    if (!influencerId) {
      setScenes([]);
      setIsLoading(false);
      setErrorMessage(null);
      return;
    }

    let cancelled = false;
    setIsLoading(true);
    setErrorMessage(null);

    void (async () => {
      try {
        const response = await influencerServices.getAdultCharacters(influencerId);
        const activeCharacters = response
          .filter((character) => character.is_active)
          .sort((a, b) => a.display_order - b.display_order);

        const nextScenes = await Promise.all(
          activeCharacters.map(async (character) => {
            const titlePlaceholderData = character.lottie_text_url
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
              titlePlaceholderData,
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
            } satisfies Scene;
          }),
        );

        if (!cancelled) {
          setScenes(nextScenes);
        }
      } catch {
        if (!cancelled) {
          setScenes([]);
          setErrorMessage("Unable to load scenarios right now.");
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
    if (scene.slug !== "girlfriend" && needsGate) {
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
    const result = await startConversation({
      flow: "adult-character",
      characterId: selectedScene.id,
    });
    if (result?.errorStatus === 402) {
      isCreditsErrorRef.current = true;
      setShowTopupModal(true);
    }
  };

  const handleEndCall = async () => {
    await stopConversation();
  };

  const isGirlfriendScene = selectedScene?.slug === "girlfriend";

  const showVideo =
    Boolean(selectedScene?.video.webm) || Boolean(selectedScene?.video.mp4);

  return (
    <div className={styles.container}>
      {isLoading ? (
        <div className={styles.loadingState}>
          <LoadingSpinner size="medium" />
        </div>
      ) : errorMessage ? (
        <div className={styles.statusState}>
          <div className={styles.statusText}>{errorMessage}</div>
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
              {scenes.map((scene) => (
                <div key={scene.id} className={`${styles.sceneItem}${scene.slug === "girlfriend" ? ` ${styles.girlfriendSceneItem}` : ""}`}>
                  <AdultSceneSelector
                    name={scene.name}
                    description={scene.description}
                    imageSmallSrc={scene.image.small}
                    imageLargeSrc={scene.image.large}
                    titlePlaceholderData={scene.titlePlaceholderData}
                    isGirlfriend={scene.slug === "girlfriend"}
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
            {sessionState === "preview" && (
              <IconButton
                type="pill"
                color="black"
                leftIcon={
                  <Suspense fallback={null}>
                    <SvgPack.CloseSquare className={styles.previewCloseIcon} />
                  </Suspense>
                }
                onClick={handleCloseScenario}
                className={styles.previewCloseButton}
              />
            )}
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
              {sessionState === "preview" && (
                <>
                  <div className={styles.sessionName}>{selectedScene.name}</div>
                  <div className={styles.previewPanel}>
                    <div className={styles.subtitle}>Scenario Details</div>
                    <div className={styles.sessionDescription}>
                      {selectedScene.scenarioDetails}
                    </div>
                    <div className={styles.previewActions}>
                      {isGirlfriendScene ? (
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
                          leftIcon={
                            <Suspense fallback={null}>
                              <SvgPack.Call className={styles.callButtonIcon} />
                            </Suspense>
                          }
                        />
                      )}
                    </div>
                  </div>
                </>
              )}
              {!isGirlfriendScene && (
                <div
                  className={`${styles.activePanel} ${sessionState === "active" ? styles.activePanelVisible : styles.activePanelHidden}`}
                >
                  <div className={styles.subtitle}>{activeStatusLabel}</div>
                  <div className={styles.sessionTimer}>{formatTime(showCallTime)}</div>
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
                  {isGirlfriendScene ? (
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
