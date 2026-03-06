import React, { Suspense, useState } from "react";
import { createPortal } from "react-dom";
import styles from "./InfluencerPopup.module.css";
import InfluencerProfileCard from "@/ui/components/profile/InfluencerProfileCard";
import RelationshipStageProgress from "@/ui/components/stats/RelationshipStageProgress";
import RelatioshipAffinities from "@/ui/components/stats/RelatioshipAffinities";
import RelationshipRadar from "@/ui/components/visualizations/RelationshipRadart";

interface InfluencerPopupProps {
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
    onlyFansUrl?: string;
    instagramUrl?: string;
    tiktokUrl?: string;
    snapchatUrl?: string;
    telegramUrl?: string;
    xUrl?: string;
    whatsappUrl?: string;
  };
}

export default function InfluencerPopup({
  isOpen,
  onClose,
  influencerData,
}: InfluencerPopupProps) {
  const [isClosing, setIsClosing] = useState(false);

  const handleClose = () => {
    setIsClosing(true);
    setTimeout(() => {
      setIsClosing(false);
      onClose();
    }, 300);
  };

  if (!isOpen || !influencerData) return null;

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      handleClose();
    }
  };

  return createPortal(
    <div
      className={`${styles.overlay} ${isClosing ? styles.closing : ""}`}
      onClick={handleOverlayClick}
    >
      <div className={`${styles.popupContainer} ${isClosing ? styles.closing : ""}`}>
        <button className={styles.closeBtn} onClick={handleClose}>
          ✕
        </button>

        <div className={styles.content}>
          <h2 className={styles.profileTitle}>{influencerData.name}</h2>
          <div className={styles.profileDetails}>
            {/* Profile Section */}
            <div className={styles.section01}>
              <Suspense fallback={null}>
                <InfluencerProfileCard
                  name={influencerData.name}
                  image={influencerData.image}
                  video={influencerData.video}
                  lastConnected={influencerData.lastConnected}
                  followingSince={influencerData.followingSince}
                  isSubscribed={influencerData.isSubscribed}
                  onlyFansUrl={influencerData.onlyFansUrl}
                  instagramUrl={influencerData.instagramUrl}
                  tiktokUrl={influencerData.tiktokUrl}
                  snapchatUrl={influencerData.snapchatUrl}
                  telegramUrl={influencerData.telegramUrl}
                  xUrl={influencerData.xUrl}
                  whatsappUrl={influencerData.whatsappUrl}
                />
              </Suspense>
            </div>

            {/* Stage Progress Section */}
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

            {/* Radar Section */}
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

            {/* Affinities Section */}
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
        </div>
      </div>
    </div>,
    document.body
  );
}
