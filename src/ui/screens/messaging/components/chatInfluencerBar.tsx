import React from "react";
import LottieAnimation from "@/ui/components/LottieAnimation";
import rankUp from "@/assets/lottie/rankUp.json"
import rankDown from "@/assets/lottie/rankDown.json"
import bellaVideo from "@/assets/mock/profile-video/0af48251-5061-4cf2-8c48-13d0ddd3c52c.mp4";
import switchProfileImg from "@/assets/svg/switchProfile.svg";
import styles from "./chatInfluencerBar.module.css";
import metricPlacholder01 from "@/assets/image/ph01.png";
import metricPlacholder02 from "@/assets/image/ph02.png";
import metricPlacholder03 from "@/assets/image/ph03.png";
import metricPlacholder04 from "@/assets/image/ph04.png";


type RankState = "up" | "down";
type GlowVariant = "default" | "adult";


export type ChatInfluencerBarProps = {
  name?: string;
  statusIcon?: React.ReactNode;
  middleContent?: React.ReactNode;
  loveScore?: number | string;
  rankState?: RankState;
  glowVariant?: GlowVariant;
  onChangeInfluencer?: () => void;
};

export default function ChatInfluencerBar({
  name = "Olivia F.",
  statusIcon = "💬",
  loveScore = -888,
  rankState = "up",
  glowVariant = "default",
  onChangeInfluencer,
}: ChatInfluencerBarProps) {
  const loveScoreClass =
    rankState === "up" ? styles.loveScoreRankUp : styles.loveScoreRankDown;

  const rankClass = rankState === "up" ? styles.rankUp : styles.rankDown;

  const glowClass =
    glowVariant === "adult" ? styles.glowStatusCircleAdult : styles.glowStatusCircleDefault;

  const profileSwitch =
    glowVariant === "adult" ? styles.profileSwitchAdult : "";

  return (
    <div className={styles.chatInfluencerBar}>
      <div className={styles.influencerTop}>
        <div className={styles.influencerStatsContainer}>
          <div className={styles.influencerStatsRow}>
            <div className={styles.leftCol}>
              <p>{name}</p>
            </div>

            <div className={styles.middleCol}></div>

            <div className={styles.rightCol}>
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
<div className={styles.profileLeftCol}><div className={styles.profileMetricContainer}> <img src={metricPlacholder01} /> <div className={styles.metricLabel}>Trust</div> </div><div className={styles.profileMetricContainer}><img src={metricPlacholder02} /><div className={styles.metricLabel}>Closeness</div></div> </div>
<div className={styles.profileMidCol}>
  <div className={styles.profileImage}>    <video
    className={styles.profileVideo}
    src={bellaVideo}
    autoPlay
    muted
    loop
    playsInline
    preload="auto"
  /></div>
  <button
  type="button"
  className={`${styles.profileSwitch} ${profileSwitch}`}
  onClick={onChangeInfluencer}
  aria-label="Change influencer"
>
  <img src={switchProfileImg} /> <div className={styles.switchProfileLabel}>Switch Influencer</div>
</button>

</div>
<div className={styles.profileRightCol}> <div className={styles.profileMetricContainer}> <img src={metricPlacholder03} /> <div className={styles.metricLabel}>Attraction</div></div> <div className={styles.profileMetricContainer}><img src={metricPlacholder04} /><div className={styles.metricLabel}>Safety</div></div>  </div>

      </div>
    </div>
  );
}