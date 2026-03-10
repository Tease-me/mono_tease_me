import React, { Suspense } from "react";
import styles from "./RelationshipPopup.module.css";
import FullScreenPopup from "@/ui/components/modals/FullScreenPopup";
import InfluencerProfileCard, { SocialLinks } from "@/ui/components/profile/InfluencerProfileCard";
import RelationshipStageProgress from "@/ui/components/stats/RelationshipStageProgress";
import RelatioshipAffinities from "@/ui/components/stats/RelatioshipAffinities";
import RelationshipRadar from "@/ui/components/visualizations/RelationshipRadart";

interface RelationshipPopupProps {
  isOpen: boolean;
  onClose: () => void;
  influencerData?: {
    name: string;
    image: string;
    video?: string;
    lastConnected: string;
    followingSince: string;
    isSubscribed?: boolean;
    sentimentScore?: number;
    currentStage?: string;
    nextStage?: string;
    trust?: number;
    closeness?: number;
    attraction?: number;
    safety?: number;
    socials?: SocialLinks;
  };
}

export default function RelationshipPopup({
  isOpen,
  onClose,
  influencerData,
}: RelationshipPopupProps) {
  if (!influencerData) return null;

  return (
    <FullScreenPopup isOpen={isOpen} onClose={onClose} title={influencerData.name}>
      <div className={styles.profileDetails}>
        <div className={styles.section01}>
          <Suspense fallback={null}>
            <InfluencerProfileCard
              name={influencerData.name}
              image={influencerData.image}
              video={influencerData.video}
              lastConnected={influencerData.lastConnected}
              followingSince={influencerData.followingSince}
              isSubscribed={influencerData.isSubscribed}
              socials={influencerData.socials}
            />
          </Suspense>
        </div>

        <div className={styles.section02}>
          <h3 className={styles.sectionHeading}>Relationship Statistics</h3>
          {influencerData.sentimentScore !== undefined &&
           influencerData.currentStage && (
            <RelationshipStageProgress
              sentimentScore={influencerData.sentimentScore}
              large
              currentStage={influencerData.currentStage}
              nextStage={influencerData.nextStage}
            />
          )}
        </div>

        <div className={styles.section03}>
          {(influencerData.trust !== undefined ||
            influencerData.closeness !== undefined ||
            influencerData.attraction !== undefined ||
            influencerData.safety !== undefined) && (
              <div className={styles.radarWrapper}>
                <RelationshipRadar
                  trust={influencerData.trust ?? 0}
                  closeness={influencerData.closeness ?? 0}
                  attraction={influencerData.attraction ?? 0}
                  safety={influencerData.safety ?? 0}
                  width={380}
                  height={380}
                />
              </div>
            )}
        </div>

        <div className={styles.section04}>
          <h3 className={styles.sectionHeading}>Affinities</h3>
          {(influencerData.trust !== undefined ||
            influencerData.closeness !== undefined ||
            influencerData.attraction !== undefined ||
            influencerData.safety !== undefined) && (
              <Suspense fallback={null}>
                <RelatioshipAffinities
                  trust={influencerData.trust ?? 0}
                  closeness={influencerData.closeness ?? 0}
                  attraction={influencerData.attraction ?? 0}
                  safety={influencerData.safety ?? 0}
                  large
                />
              </Suspense>
            )}
        </div>
      </div>
    </FullScreenPopup>
  );
}
