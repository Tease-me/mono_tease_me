import { useCallback, useEffect, useState } from "react";
import { apiClient } from "@/api/apis";
import type { UserGalleryResponse, UserGalleryScenario } from "@/api/models/userGallery";
import { UserServices } from "@/api/services/UserServices";
import LoadingSpinner from "@/ui/components/loading/LoadingSpinner";
import ScenarioStoryViewer from "./ScenarioStoryViewer";
import styles from "./UserGalleryPage.module.css";

const userService = UserServices(apiClient);

type UserGalleryPageProps = {
  influencerId: string;
};

export default function UserGalleryPage({ influencerId }: UserGalleryPageProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [scenarios, setScenarios] = useState<UserGalleryResponse["scenarios"]>([]);
  const [activeScenario, setActiveScenario] = useState<UserGalleryScenario | null>(null);

  const loadGallery = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await userService.getUserGallery(influencerId);
      setScenarios(data.scenarios);
    } catch {
      setScenarios([]);
      setError("Could not load your gallery right now.");
    } finally {
      setLoading(false);
    }
  }, [influencerId]);

  useEffect(() => {
    void loadGallery();
  }, [loadGallery]);

  return (
    <div className="u-sidebar-page">
      <div className={styles.page}>
        <p className={styles.intro}>
          Tap a scenario — unlocked stages play automatically in order.
        </p>

        {loading && (
          <div className={styles.loadingState}>
            <LoadingSpinner size="small" />
          </div>
        )}

        {!loading && error && <div className={styles.emptyState}>{error}</div>}

        {!loading && !error && scenarios.length === 0 && (
          <div className={styles.emptyState}>
            No unlocked scenes yet. Start a call and watch scenario stages to save them
            here.
          </div>
        )}

        {!loading && !error && scenarios.length > 0 && (
          <div className={styles.scenarioGrid}>
            {scenarios.map((scenario) => (
              <button
                key={scenario.character_id}
                type="button"
                className={styles.scenarioTile}
                onClick={() => setActiveScenario(scenario)}
              >
                {scenario.poster_url ? (
                  <img
                    src={scenario.poster_url}
                    alt={scenario.name}
                    className={styles.scenarioTileImage}
                  />
                ) : (
                  <div className={styles.scenarioTileFallback} />
                )}
                <span className={styles.scenarioTileBadge}>{scenario.stages.length}</span>
                <span className={styles.scenarioTileLabel}>{scenario.name}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {activeScenario && (
        <ScenarioStoryViewer
          scenario={activeScenario}
          onClose={() => setActiveScenario(null)}
        />
      )}
    </div>
  );
}
