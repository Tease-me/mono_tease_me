import React from "react";
import styles from "./chatInfluencerBar.module.css";

type RankState = "up" | "down";
type GlowVariant = "default" | "adult";

export type ChatInfluencerBarProps = {
  name?: string;
  statusIcon?: React.ReactNode;
  middleContent?: React.ReactNode;
  loveScore?: number | string;
  rankState?: RankState;
  glowVariant?: GlowVariant;
};

export default function ChatInfluencerBar({
  name = "Olivia F.",
  statusIcon = "💬",
  middleContent = "X",
  loveScore = -888,
  rankState = "up",
  glowVariant = "default",
}: ChatInfluencerBarProps) {
  const loveScoreClass =
    rankState === "up" ? styles.loveScoreRankUp : styles.loveScoreRankDown;

  const rankClass = rankState === "up" ? styles.rankUp : styles.rankDown;

  const glowClass =
    glowVariant === "adult" ? styles.glowStatusCircleAdult : styles.glowStatusCircleDefault;

  return (
    <div className={styles.chatInfluencerBar}>
      <div className={styles.influencerTop}>
        <div className={styles.influencerStatsContainer}>
          <div className={styles.influencerStatsRow}>
            <div className={styles.leftCol}>
              <p>{name}</p>
            </div>

            <div className={styles.middleCol}>{middleContent}</div>

            <div className={styles.rightCol}>
              <div className={styles.status}>{statusIcon}</div>

              <div className={`${styles.loveScore} ${loveScoreClass}`}>
                <p>{loveScore}</p>
                <div className={`${styles.rank} ${rankClass}`}>
                  {rankState === "up" ? "↑" : "↓"}
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
    </div>
  );
}