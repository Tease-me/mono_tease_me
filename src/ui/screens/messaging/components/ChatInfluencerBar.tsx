import React, { useState, useEffect } from "react";
import switchProfileImg from "@/assets/svg/switchProfile.svg";
import clsx from "clsx";
import { InfluencerDataModel } from "@/data/models/InfluencerDataModel";
import ProfileMedia from "@/ui/components/ProfileMedia";
import { RelationshipResponse } from "@/api/models/relationship";
import MetricRing from "@/ui/components/stats/MetricRing";
import SvgPack from "@/utils/SvgPack";
import LoveScore from "./LoveScore";
import InfluencerPopup from "../components/InfluencerPopup";
import styles from "./ChatInfluencerBar.module.css";
import {
  getRelationshipStatusIcon,
  getRelationshipStatusLabel,
  RelationshipStatus,
} from "@/utils/relationshipStatusUtils";
import { apiClient } from "@/api/apis";
import { RelationshipServices } from "@/api/services/RelationshipServices";
import { formatDate } from "@/utils/DateTimeUtils";

export type ChatInfluencerBarProps = {
  relationship?: RelationshipResponse
  influencer?: InfluencerDataModel;
  middleContent?: React.ReactNode;
  showChangeInfluencerButton?: boolean;
  sentimentDelta?: number | string;
  adultMode?: boolean;
  status?: string;
  onChangeInfluencer?: () => void;
  isSubscribed?: boolean;
};

const relationshipService = RelationshipServices(apiClient);

export default function ChatInfluencerBar({
  relationship,
  influencer,
  status = "Network Error",
  adultMode = false,
  showChangeInfluencerButton = false,
  onChangeInfluencer,
  isSubscribed = false,
}: ChatInfluencerBarProps) {
  const [isPopupOpen, setIsPopupOpen] = useState(false);
  const [stageValue, setStageValue] = useState<number>(0);
  const [currentStage, setCurrentStage] = useState<string>("");
  const [nextStage, setNextStage] = useState<string>("");

  useEffect(() => {
    if (!influencer?.id) {
      setStageValue(0);
      setCurrentStage("");
      setNextStage("");
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const dims = await relationshipService.getDimensions(influencer.id);
        if (!cancelled) {
          setStageValue(dims.stage_points);
          setCurrentStage(dims.current_stage);
          setNextStage(dims.next_stage);
        }
      } catch {
        if (!cancelled) {
          setStageValue(0);
          setCurrentStage("");
          setNextStage("");
        }
      }
    })();

    return () => { cancelled = true; };
  }, [influencer?.id]);

  const glowClass =
    adultMode ? styles.glowStatusCircleAdult : styles.glowStatusCircleDefault;

  const profileSwitch = adultMode ? styles.profileSwitchAdult : "";

  const handleOpenPopup = () => {
    setIsPopupOpen(true);
  };

  const handleClosePopup = () => {
    setIsPopupOpen(false);
  };

  return (
    <div className={styles.chatInfluencerBar}>
      <div className={styles.influencerTop}>
        <div className={styles.influencerStatsContainer}>
          <div className={styles.influencerStatsRow}>
            <div className={styles.leftCol}>
              <p>{influencer?.name}</p><p className={styles.statusText}>{status}</p>
            </div>
            <div className={styles.middleCol}></div>
            <div className={clsx(styles.rightCol, adultMode && styles.hidden)}>
              <div className={styles.relationshipStatus}>
                {getRelationshipStatusIcon(relationship?.state as RelationshipStatus)}
                <div className={styles.relationshipStatusLabel}>
                  {getRelationshipStatusLabel(relationship?.state)}
                </div>
              </div>
              <LoveScore sentimentDelta={relationship?.sentiment_delta} />
            </div>
          </div>
        </div>
        <div className={styles.circleGlowContainer}>
          <div className={styles.glowStatusWhite} />
          <div className={styles.glowStatusCircle02} />
          <div className={`${styles.glowStatusCircle} ${glowClass}`} />
        </div>
      </div>
      <div className={styles.influencerBottom} />
      <div className={styles.profileContainer}>
        <div className={clsx(styles.profileLeftCol, adultMode && styles.hidden)}>
          <div className={styles.profileMetricContainer}>
            <MetricRing icon={<SvgPack.Trust />} size="small" value={relationship?.trust} />
            <div className={styles.metricLabel}>Trust</div>
          </div>
          <div className={styles.profileMetricContainer}>
            <MetricRing icon={<SvgPack.Angles />} size="small" value={relationship?.closeness} />
            <div className={styles.metricLabel}>Closeness</div>
          </div>
        </div>
        <div className={styles.profileMidCol}>
          <div onClick={adultMode ? undefined : handleOpenPopup} className={clsx(!adultMode && styles.profileImageClick)}>
            <ProfileMedia size="medium" videoSrc={influencer?.videoUrl} imageSrc={influencer?.img} />
          </div>
          <button
            type="button"
            className={clsx(styles.profileSwitch, profileSwitch, !showChangeInfluencerButton && styles.hidden)}
            onClick={onChangeInfluencer}
            aria-label="Change influencer"
          >
            <img src={switchProfileImg} /> <div className={styles.switchProfileLabel}>Switch Influencer</div>
          </button>

        </div>
        <div className={clsx(styles.profileRightCol, adultMode && styles.hidden)}>
          <div className={styles.profileMetricContainer}>
            <MetricRing icon={<SvgPack.KissGray />} size="small" value={relationship?.attraction} />
            <div className={styles.metricLabel}>Attraction</div>
          </div>
          <div className={styles.profileMetricContainer}>
            <MetricRing icon={<SvgPack.Shield />} size="small" value={relationship?.safety} />
            <div className={styles.metricLabel}>Safety</div>
          </div>
        </div>
      </div>

      <InfluencerPopup
        isOpen={isPopupOpen}
        onClose={handleClosePopup}
        influencerData={
          influencer
            ? {
              name: influencer.name || "",
              image: influencer.img || "",
              lastConnected: formatDate(relationship?.last_interaction_at),
              followingSince: formatDate(influencer.created_at),
              isSubscribed: isSubscribed,
              stageValue: stageValue,
              currentStage: currentStage,
              nextStage: nextStage,
              trust: relationship?.trust,
              closeness: relationship?.closeness,
              attraction: relationship?.attraction,
              safety: relationship?.safety,
            }
            : undefined
        }
      />
    </div>
  );
}
