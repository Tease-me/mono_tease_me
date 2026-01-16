import React from "react";
import LottieAnimation from "@/ui/components/LottieAnimation";
import rankUp from "@/assets/lottie/rankUp.json"
import rankDown from "@/assets/lottie/rankDown.json"
import switchProfileImg from "@/assets/svg/switchProfile.svg";
import styles from "./ChatInfluencerBar.module.css";
import metricPlacholder01 from "@/assets/image/ph01.png";
import metricPlacholder02 from "@/assets/image/ph02.png";
import metricPlacholder03 from "@/assets/image/ph03.png";
import metricPlacholder04 from "@/assets/image/ph04.png";
import clsx from "clsx";
import { InfluencerDataModel } from "@/data/models/InfluencerDataModel";
import ProfileMedia from "@/ui/components/ProfileMedia";
import { RelationshipResponse } from "@/api/models/relationship";
import MetricRing from "@/ui/components/stats/MetricRing";
import SvgPack from "@/utils/SvgPack";

type RankState = "up" | "down";

export type ChatInfluencerBarProps = {
  relationship?: RelationshipResponse
  influencer?: InfluencerDataModel;
  statusIcon?: React.ReactNode;
  middleContent?: React.ReactNode;
  showChangeInfluencerButton?: boolean;
  loveScore?: number | string;
  rankState?: RankState;
  adultMode?: boolean;
  status?: string;
  onChangeInfluencer?: () => void;
};

export default function ChatInfluencerBar({
  relationship,
  influencer,
  statusIcon = "💬",
  loveScore = -888,
  rankState = "up",
  status = "Network Error",
  adultMode = true,
  showChangeInfluencerButton = false,
  onChangeInfluencer,
}: ChatInfluencerBarProps) {
  const loveScoreClass =
    rankState === "up" ? styles.loveScoreRankUp : styles.loveScoreRankDown;

  const rankClass = rankState === "up" ? styles.rankUp : styles.rankDown;

  const glowClass =
    adultMode ? styles.glowStatusCircleAdult : styles.glowStatusCircleDefault;

  const profileSwitch = adultMode ? styles.profileSwitchAdult : "";

  return (
    <div className={styles.chatInfluencerBar}>
      <div className={styles.influencerTop}>
        <div className={styles.influencerStatsContainer}>
          <div className={styles.influencerStatsRow}>
            <div className={styles.leftCol}>
              <p>{influencer?.name}</p> | <p>{status}</p>
            </div>
            <div className={styles.middleCol}></div>
            <div className={clsx(styles.rightCol, adultMode && styles.hidden)}>
              <div className={styles.relationshipStatus}>{statusIcon} <div className={styles.relationshipStatusLabel}>Talking</div> </div>
              <div className={`${styles.loveScore} ${loveScoreClass}`}>
                <p>{loveScore}</p>
                <div className={`${styles.rank} ${rankClass}`}>
                  {rankState === "up" ? <LottieAnimation autoplay loop animationData={rankUp} /> : <LottieAnimation autoplay loop animationData={rankDown} />}
                </div>
              </div>
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
          <ProfileMedia active size="medium" videoSrc={influencer?.videoUrl} imageSrc={influencer?.img} />
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