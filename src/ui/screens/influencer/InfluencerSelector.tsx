import React, { useEffect, useState } from "react";
import styles from "./InfluencerSelector.module.css";
import { InfluencerDataModel } from "@/data/models/InfluencerDataModel";
import InfluencerRelationCard from "@/ui/components/cards/InfluencerRelationCard";
import IconButton from "@/ui/components/inputs/buttons/IconButton";
import LoadingSpinner from "@/ui/components/loading/LoadingSpinner";
import { apiClient } from "@/api/apis";
import { RelationshipServices } from "@/api/services/RelationshipServices";
import { BalanceServices } from "@/api/services/BalanceServices";
import BackgroundGradient from "@/ui/templates/BackgroundGradient";

// IMPORTANT - TODO
// THERE IS A SMALL ERROR DIV AT THE END REMOVE IT AND HANDLE PROPERLY

interface InfluencerSelectorProps {
  influencers: InfluencerDataModel[];
  onItemClick?: (id: string) => void;
}

type InfluencerCardItem = {
  id: string;
  name: string;
  image: string;
  video: string;
  balance: number;
  lastConnected: string;
  loveScore: number;
  status: string;
  trust: number;
  safety: number;
  attraction: number;
  closeness: number;
};

const relationshipService = RelationshipServices(apiClient);
const balanceService = BalanceServices(apiClient);

export default function InfluencerSelector({
  influencers,
  onItemClick,
}: InfluencerSelectorProps) {
  const [items, setItems] = useState<InfluencerCardItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let canceled = false;

    const load = async () => {
      try {
        setLoading(true);
        setError(null);

        if (influencers.length === 0) {
          if (!canceled) setItems([]);
          return;
        }

        const cards = await Promise.all(
          influencers.map(async (inf) => {
            const [rel, blc] = await Promise.all([
              relationshipService.getRelationship(inf.id),
              balanceService.getBalance(inf.id).catch(() => null),
            ]);

            const balanceValue = blc ? blc.balance_cents / 100 : 0;

            return {
              id: inf.id,
              name: inf.name,
              image: inf.img,
              video: (inf as any).videoUrl || inf.videoUrl,
              balance: balanceValue,
              lastConnected: rel.last_interaction_at || "",
              loveScore: rel.sentiment_score || 0,
              status: rel.state,
              trust: rel.trust,
              safety: rel.safety,
              attraction: rel.attraction,
              closeness: rel.closeness,
            };
          })
        );

        if (!canceled) setItems(cards);
      } catch (e: any) {
        if (!canceled) setError(e?.message || "Failed to load influencer data");
        console.error("Error: ", e);
      } finally {
        if (!canceled) setLoading(false);
      }
    };

    load();
    return () => {
      canceled = true;
    };
  }, [influencers]);

  return (
    <BackgroundGradient>
      <div className={styles.container}>
        {loading ? (
          <div className={styles.loading}>
            <LoadingSpinner />
          </div>
        ) : (
          <div className={styles.list}>
            {items.map((inf) => (
              <>
              <div key={inf.id}>
                <div className={styles.card}>
                  <InfluencerRelationCard {...inf} />
                </div>
                <div className={styles.buttonRow}>
                  <IconButton
                    text="Chat"
                    onClick={() => onItemClick?.(inf.id)}
                    color="black"
                    className={styles.chatButton}
                  />
                </div>
              </div>
              </>
            ))}
            {error && <div className={styles.error}>{error}</div>}
          </div>
        )}
      </div>
      </BackgroundGradient>
  );
}
