import { useEffect, useState } from "react";
import InfluencerRelationCard from "@/ui/components/cards/InfluencerRelationCard";

import IconButton from "@/ui/components/inputs/buttons/IconButton";
import { RelationshipServices } from "@/api/services/RelationshipServices";
import { InfluencerRepo } from "@/data/repositories/InfluencerRepo";
import { BalanceServices } from "@/api/services/BalanceServices";
import { apiClient } from "@/api/apis";
import LoadingSpinner from "@/ui/components/loading/LoadingSpinner";

import styles from "./ManageInfluencers.module.css"

const relationshipService = RelationshipServices(apiClient);

type MyInfleuncerProps = {
  goTo: (id: string, payload?: Record<string, any>) => void;
  navPayload?: Record<string, any>;
  goBack?: () => void;
};

const MyInfluencers: React.FC<MyInfleuncerProps> = ({ goTo }) => {
  const [items, setItems] = useState<
    Array<{
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
      followingSince: string;
    }>
  >([]);

  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const followed = await InfluencerRepo().getFollowedInfluencers();
        const balanceSvc = BalanceServices(apiClient);

        setItems(
          followed.map((inf) => ({
            id: inf.id,
            name: inf.name,
            image: inf.img,
            video: (inf as any).videoUrl || inf.videoUrl,
            balance: 0,
            lastConnected: "",
            loveScore: 0,
            status: "",
            trust: 0,
            safety: 0,
            attraction: 0,
            closeness: 0,
            followingSince: inf.created_at,
          }))
        );
        setLoading(false)


        const cards = await Promise.all(
          followed.map(async (inf) => {
            const [rel, balanceRes] = await Promise.all([
              relationshipService.getRelationship(inf.id),
              balanceSvc.getBalance(inf.id).catch(() => null),
            ]);

            const balanceValue = balanceRes ? balanceRes.balance_cents / 100 : 0;

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
              followingSince: inf.created_at || "--"
            };
          })
        );
        setItems(cards);
      } catch (e: any) {
        setError(e?.message || "Failed to load influencer data");
        console.error(e)
      }
    };
    load();
  }, []);


  const handleViewProfile = (inf: any) => {
    goTo("influencer_profile", {
      influencerId: inf.id,
      name: inf.name,
      image: inf.image,
      video: inf.video,
      balance: inf.balance,
      lastConnected: inf.lastConnected,
      trust: inf.trust,
      safety: inf.safety,
      attraction: inf.attraction,
      closeness: inf.closeness,
      stageScore: inf.loveScore,
      followingSince: inf.followingSince,
    });
  };

  return (
    <div className={styles.container}>
      {loading ? <div className={styles.loading} >{<LoadingSpinner />} </div> :
        <div className={styles.list}>
          {items.map((inf) => (
            <div>
              <div key={inf.id} className={styles.card}>
                <InfluencerRelationCard {...inf} />
              </div>
              <div className={styles.buttonRow}>
                <IconButton text="View Profile" onClick={() => handleViewProfile(inf)} color="black" className={styles.viewProfile} />
              </div>
            </div>

          ))}

          <div className={styles.error}>{error}</div>
        </div>
                    }
    </div>
  );
};

export default MyInfluencers;
