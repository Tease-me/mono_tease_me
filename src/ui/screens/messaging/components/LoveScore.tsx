import React from "react";
import clsx from "clsx";
import LottieAnimation from "@/ui/components/LottieAnimation";
import rankUp from "@/assets/lottie/rankUp.json";
import rankDown from "@/assets/lottie/rankDown.json";
import styles from "./LoveScore.module.css";

export type LoveScoreProps = {
  sentimentDelta?: number | null;
  className?: string;
  size?: "small" | "medium" | "large";
  rankPosition?: "left" | "right";
};

export default function LoveScore({
  sentimentDelta,
  className,
  size = "medium",
  rankPosition = "right",
}: LoveScoreProps) {
  const parsedScore = Number(sentimentDelta);
  const numericScore = Number.isFinite(parsedScore) ? parsedScore : 0;
  const displayScore = Number.isFinite(parsedScore) ? parsedScore.toFixed(2) : "";
  const isPositive = numericScore > 0;

  const loveScoreClass = isPositive ? styles.loveScoreRankUp : styles.loveScoreRankDown;
  const rankClass = isPositive ? styles.rankUp : styles.rankDown;
  const sizeClass =
    size === "small" ? styles.loveScoreSmall : size === "large" ? styles.loveScoreLarge : styles.loveScoreMedium;
  const rankSizeClass =
    size === "small" ? styles.rankSmall : size === "large" ? styles.rankLarge : styles.rankMedium;

  return (
    <div className={clsx(styles.loveScore, loveScoreClass, sizeClass, className)}>
      {rankPosition === "left" && (
        <div className={clsx(styles.rank, rankClass, rankSizeClass)}>
          {isPositive ? (
            <LottieAnimation autoplay loop animationData={rankUp} />
          ) : (
            <LottieAnimation autoplay loop animationData={rankDown} />
          )}
        </div>
      )}
      <p className={styles.loveScoreValue}>{displayScore}</p>
      {rankPosition === "right" && (
        <div className={clsx(styles.rank, rankClass, rankSizeClass)}>
          {isPositive ? (
            <LottieAnimation autoplay loop animationData={rankUp} />
          ) : (
            <LottieAnimation autoplay loop animationData={rankDown} />
          )}
        </div>
      )}
    </div>
  );
}
