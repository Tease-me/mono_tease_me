import { useEffect, useState } from "react";
import { apiClient } from "@/api/apis";
import { InfluencerServices } from "@/api/services/InfluencerService";
import AdultSceneSelector from "@/ui/components/cards/AdultSceneSelectorCard";
import IconButton from "@/ui/components/inputs/buttons/IconButton";
import LoadingSpinner from "@/ui/components/loading/LoadingSpinner";
import styles from "./AdultMode.module.css";
import SvgPack from "@/utils/SvgPack";

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

type AdultModeProps = {
  influencerId: string;
};

const influencerServices = InfluencerServices(apiClient);

export default function AdultMode({ influencerId }: AdultModeProps) {
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [selectedScene, setSelectedScene] = useState<Scene | null>(null);
  const [sessionState, setSessionState] = useState<SessionState>("preview");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    setSelectedScene(null);
    setSessionState("preview");
    setIsLoading(true);
  }, [influencerId]);

  useEffect(() => {
    if (!influencerId) {
      setScenes([]);
      setIsLoading(false);
      return;
    }

    const abortController = new AbortController();
    setIsLoading(true);

    void (async () => {
      try {
        const response = await influencerServices.getAdultCharacters(influencerId);
        const activeCharacters = response
          .filter((character) => character.is_active)
          .sort((a, b) => a.display_order - b.display_order);

        const lottieCache = new Map<string, unknown | null>();

        const nextScenes = await Promise.all(
          activeCharacters.map(async (character) => {
            let titlePlaceholderData: unknown | null = null;

            if (character.lottie_text_url) {
              if (!lottieCache.has(character.lottie_text_url)) {
                try {
                  const lottieResponse = await fetch(character.lottie_text_url, {
                    signal: abortController.signal,
                  });
                  const lottieData = lottieResponse.ok
                    ? ((await lottieResponse.json()) as unknown)
                    : null;
                  lottieCache.set(character.lottie_text_url, lottieData);
                } catch {
                  lottieCache.set(character.lottie_text_url, null);
                }
              }
              titlePlaceholderData =
                lottieCache.get(character.lottie_text_url) ?? null;
            }

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

        if (!abortController.signal.aborted) {
          setScenes(nextScenes);
        }
      } catch {
        if (!abortController.signal.aborted) {
          setScenes([]);
        }
      } finally {
        if (!abortController.signal.aborted) {
          setIsLoading(false);
        }
      }
    })();

    return () => {
      abortController.abort();
    };
  }, [influencerId]);

  const handleSelectScenario = (scene: Scene) => {
    setSelectedScene(scene);
    setSessionState("preview");
  };

  const handleCloseScenario = () => {
    setSelectedScene(null);
  };

  const handleStartCall = () => {
    setSessionState("active");
  };

  const handleEndCall = () => {
    setSessionState("preview");
  };

  const showVideo =
    Boolean(selectedScene?.video.webm) || Boolean(selectedScene?.video.mp4);

  return (
    <div className={styles.container}>
      {isLoading ? (
        <div className={styles.loadingState}>
          <LoadingSpinner size="large" />
        </div>
      ) : !selectedScene ? (
        <div className={styles.page1}>
          <div className={styles.header}>Select a scenario</div>
          <div className={styles.selectionArea}>
            <div
              className={`${styles.scenesList} ${scenes.length > 1 ? styles.edgeFade : ""}`}
            >
              {scenes.map((scene) => (
                <div key={scene.id} className={styles.sceneItem}>
                  <AdultSceneSelector
                    name={scene.name}
                    description={scene.description}
                    imageSmallSrc={scene.image.small}
                    imageLargeSrc={scene.image.large}
                    titlePlaceholderData={scene.titlePlaceholderData}
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
        <div className={styles.sessionPage}>
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
            {sessionState === "preview" ? (
              <>
                <IconButton
                  type="pill"
                  color="black"
                  leftIcon={
                    <SvgPack.CloseSquare className={styles.previewCloseIcon} />
                  }
                  onClick={handleCloseScenario}
                  className={styles.previewCloseButton}
                />
                <div className={styles.sessionName}>{selectedScene.name}</div>
                <div className={styles.previewPanel}>
                  <div className={styles.subtitle}>Scenario Details</div>
                  <div className={styles.sessionDescription}>
                    {selectedScene.scenarioDetails}
                  </div>
                  <div className={styles.previewActions}>
                    <IconButton
                      onClick={handleStartCall}
                      color="green"
                      type="pill"
                      className={styles.callButton}
                      leftIcon={<SvgPack.Call />}
                    />
                  </div>
                </div>
              </>
            ) : (
              <div className={styles.activePanel}>
                <div className={styles.subtitle}>Connected</div>
                <div className={styles.sessionTimer}>00:00</div>
                <div className={styles.activeActions}>
                  <IconButton
                    onClick={handleEndCall}
                    color="red"
                    type="pill"
                    className={styles.activeCallButton}
                    leftIcon={<SvgPack.HangupCallIcon />}
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
