import React from "react";
import switchProfileImg from "@/assets/svg/switchProfile.svg";
import clsx from "clsx";
import { InfluencerDataModel } from "@/data/models/InfluencerDataModel";
import ProfileMedia from "@/ui/components/ProfileMedia";
import { RelationshipResponse } from "@/api/models/relationship";
import MetricRing from "@/ui/components/stats/MetricRing";
import SvgPack from "@/utils/SvgPack";
import LoveScore from "./LoveScore";
import styles from "./ChatInfluencerBar.module.css";
import { getRelationshipStatusIcon, RelationshipStatus } from "@/utils/relationshipStatusIcons";

export type ChatInfluencerBarProps = {
  relationship?: RelationshipResponse
  influencer?: InfluencerDataModel;
  middleContent?: React.ReactNode;
  showChangeInfluencerButton?: boolean;
  loveScore?: number | string;
  adultMode?: boolean;
  status?: string;
  onChangeInfluencer?: () => void;
};

export default function ChatInfluencerBar({
  relationship,
  influencer,
  status = "Network Error",
  adultMode = false,
  showChangeInfluencerButton = false,
  onChangeInfluencer,
}: ChatInfluencerBarProps) {
  const glowClass =
    adultMode ? styles.glowStatusCircleAdult : styles.glowStatusCircleDefault;

  const profileSwitch = adultMode ? styles.profileSwitchAdult : "";

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
              <div className={styles.relationshipStatus}>{getRelationshipStatusIcon(relationship?.state as RelationshipStatus)} <div className={styles.relationshipStatusLabel}>{relationship?.state}</div></div>
              <LoveScore sentimentScore={relationship?.sentiment_score} />
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
          <ProfileMedia  size="medium" videoSrc={influencer?.videoUrl} imageSrc={influencer?.img} />
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
    </div>
  );
}
