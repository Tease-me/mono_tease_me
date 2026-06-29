import { useCallback, useEffect, useRef, useState } from "react";
import type { UserGalleryScenario, UserGalleryStage } from "@/api/models/userGallery";
import CrossfadeLoopVideo from "@/ui/screens/messaging/pages/scene-selector/CrossfadeLoopVideo";
import styles from "./ScenarioStoryViewer.module.css";

const STAGE_DURATION_MS = 6000;

type ScenarioStoryViewerProps = {
  scenario: UserGalleryScenario;
  initialStageIndex?: number;
  onClose: () => void;
};

export default function ScenarioStoryViewer({
  scenario,
  initialStageIndex = 0,
  onClose,
}: ScenarioStoryViewerProps) {
  const [stageIndex, setStageIndex] = useState(initialStageIndex);
  const touchStartX = useRef<number | null>(null);
  const stages = scenario.stages;
  const currentStage: UserGalleryStage | undefined = stages[stageIndex];

  const goNext = useCallback(() => {
    setStageIndex((prev) => {
      if (prev >= stages.length - 1) {
        return prev;
      }
      return prev + 1;
    });
  }, [stages.length]);

  const goPrev = useCallback(() => {
    setStageIndex((prev) => Math.max(prev - 1, 0));
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      } else if (event.key === "ArrowRight") {
        goNext();
      } else if (event.key === "ArrowLeft") {
        goPrev();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [goNext, goPrev, onClose]);

  useEffect(() => {
    setStageIndex(Math.min(initialStageIndex, Math.max(stages.length - 1, 0)));
  }, [initialStageIndex, scenario.character_id, stages.length]);

  useEffect(() => {
    if (stages.length === 0) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      if (stageIndex >= stages.length - 1) {
        onClose();
        return;
      }
      goNext();
    }, STAGE_DURATION_MS);

    return () => window.clearTimeout(timeoutId);
  }, [stageIndex, stages.length, goNext, onClose]);

  if (!currentStage) {
    return null;
  }

  const videoSource = {
    key: `gallery-${scenario.character_id}-${currentStage.stage_index}-${currentStage.variant_index}`,
    mp4: currentStage.video_mp4_url,
    webm: currentStage.video_webm_url,
    poster: currentStage.poster_url,
  };

  return (
    <div className={styles.overlay} role="dialog" aria-modal="true">
      <div className={styles.topBar}>
        <div className={styles.progressRow}>
          {stages.map((stage, index) => (
            <div
              key={`${stage.stage_index}-${stage.variant_index}`}
              className={styles.progressSegment}
            >
              {index < stageIndex && <div className={styles.progressSegmentFill} />}
              {index === stageIndex && (
                <div
                  key={`progress-${stageIndex}`}
                  className={styles.progressSegmentActiveFill}
                  style={{ animationDuration: `${STAGE_DURATION_MS}ms` }}
                />
              )}
            </div>
          ))}
        </div>
        <button type="button" className={styles.closeButton} onClick={onClose}>
          Close
        </button>
      </div>

      <div
        className={styles.mediaArea}
        onTouchStart={(event) => {
          touchStartX.current = event.changedTouches[0]?.clientX ?? null;
        }}
        onTouchEnd={(event) => {
          const startX = touchStartX.current;
          const endX = event.changedTouches[0]?.clientX ?? null;
          touchStartX.current = null;
          if (startX == null || endX == null) {
            return;
          }
          const delta = endX - startX;
          if (delta < -48) {
            goNext();
          } else if (delta > 48) {
            goPrev();
          }
        }}
      >
        <button
          type="button"
          className={styles.navZoneLeft}
          onClick={goPrev}
          aria-label="Previous stage"
          disabled={stageIndex === 0}
        />
        <div className={styles.videoWrap}>
          <CrossfadeLoopVideo source={videoSource} className={styles.videoStack} />
        </div>
        <button
          type="button"
          className={styles.navZoneRight}
          onClick={goNext}
          aria-label="Next stage"
          disabled={stageIndex >= stages.length - 1}
        />
      </div>

      <div className={styles.footer}>
        <div className={styles.scenarioName}>{scenario.name}</div>
        <div className={styles.stageTitle}>
          {currentStage.title ?? `Stage ${currentStage.stage_index}`}
        </div>
        {currentStage.description && (
          <p className={styles.stageDescription}>{currentStage.description}</p>
        )}
        <div className={styles.stageCounter}>
          {stageIndex + 1} / {stages.length}
        </div>
      </div>
    </div>
  );
}
