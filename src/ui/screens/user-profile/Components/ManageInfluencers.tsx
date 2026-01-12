import { useEffect, useState } from "react";
import NormalButton from "@/ui/components/inputs/buttons/NormalButton";
import InfluencerRelationCard from "@/ui/components/cards/InfluencerRelationCard";

import { RelationshipServices } from "@/api/services/RelationshipServices";
import { InfluencerRepo } from "@/data/repositories/InfluencerRepo";
import { BalanceServices } from "@/api/services/BalanceServices";
import { apiClient } from "@/api/apis";

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
    }>
  >([]);


  const [error, setError] = useState<string | null>(null);


  useEffect(() => {
    const load = async () => {
      try {
        const followed = await InfluencerRepo().getFollowedInfluencers();
        const balanceSvc = BalanceServices(apiClient);

        const cards = await Promise.all(
          followed.map(async (inf) => {

            const rel = await relationshipService.getRelationship(inf.id);
            const BalanceRes = await balanceSvc.getBalance(inf.id).catch(() => { });;
            const balanceValue = BalanceRes ? BalanceRes.balance_cents / 100 : 0;
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
        setItems(cards);
      } catch (e: any) {
        setError(e?.message || "Failed to load influencer data");
        console.error(e)
      }
    };
    load();
  }, []);

  const handleViewProfile = (influencerId: string) => {
    goTo('influencer_profile', { influencerId });
  };


  return (
    <div className={styles.list}>

      {items.map((inf) => (
        <div>

          <div key={inf.id} className={styles.card}>
            <InfluencerRelationCard {...inf} />
          </div>
          <NormalButton text="View Profile" onClick={() => handleViewProfile(inf.id)} className={styles.viewProfile} />
        </div>
      ))}

      <div className={styles.error}>{error}</div>
    </div>
  );
};

export default MyInfluencers;
