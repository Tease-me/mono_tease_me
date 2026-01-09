import { useEffect, useState } from "react";
import NormalButton from "@/ui/components/inputs/buttons/NormalButton";
import InfluencerRelationCard from "@/ui/components/cards/InfluencerRelationCard";

import { RelationshipServices } from "@/api/services/RelationshipServices";
import { InfluencerRepo } from "@/data/repositories/InfluencerRepo";
import { BalanceServices } from "@/api/services/BalanceServices";
import { apiClient } from "@/api/apis";


import styles from "./MyInfluencers.module.css"

const relationshipService = RelationshipServices(apiClient);

type InfluencerRelationProps = {
  goTo: (id: string, payload?: Record<string, any>) => void;
  navPayload?: Record<string, any>;
  goBack?: () => void;
};

type InfluencerCard = {
  id?: string;
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

const InfluencerRelation: React.FC<InfluencerRelationProps> = ({ goTo, navPayload }) => {
  const [card, setCard] = useState<InfluencerCard | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      const targetId = navPayload?.influencerId;
      if (!targetId) {
        setError("No influencer selected");
        return;
      }
      try {
        const followed = await InfluencerRepo().getFollowedInfluencers();
        const inf = followed.find((f) => f.id === targetId);
        if (!inf) {
          setError("Influencer not found");
          return;
        }
        const balanceSvc = BalanceServices(apiClient);
        const rel = await relationshipService.getRelationship(inf.id);
        const balanceRes = await balanceSvc.getBalance(inf.id).catch(() => undefined);
        const balanceValue = balanceRes ? balanceRes.balance_cents / 100 : 0;
        setCard({
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
        });
      } catch (e: any) {
        setError(e?.message || "Failed to load influencer data");
        console.error(e);
      }
    };
    load();
  }, [navPayload?.influencerId]);

  const handleViewProfile = () => {
    if (card?.id) {
      goTo("influencer_profile", { influencerId: card.id });
    } else {
      goTo("influencer_profile");
    }
  };

  if (error) {
    return <div className={styles.error}>{error}</div>;
  }

  if (!card) {
    return null;
  }

  return (
    <div>
      <InfluencerRelationCard {...card} />
      <NormalButton text="View Profile" onClick={handleViewProfile} className={styles.viewProfile} />
    </div>
  );
};

export default InfluencerRelation;
