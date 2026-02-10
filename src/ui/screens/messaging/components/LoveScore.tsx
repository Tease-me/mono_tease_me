import React, { useState, useEffect } from "react";
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
  const [visible, setVisible] = useState(false);

  const parsedScore = Number(sentimentDelta);
  const numericScore = Number.isFinite(parsedScore) ? parsedScore : 0;
  const isPositive = numericScore > 0;
  const displayScore = Number.isFinite(parsedScore)
    ? `${isPositive ? '+' : ''}${parsedScore.toFixed(2)}`
    : "";

  const shouldShow = Math.abs(numericScore) >= 0.01;

  useEffect(() => {
    if (shouldShow) {
      setVisible(true);
      const timer = setTimeout(() => setVisible(false), 5000);
      return () => clearTimeout(timer);
    } else {
      setVisible(false);
    }
  }, [sentimentDelta, shouldShow]);

  const loveScoreClass = isPositive ? styles.loveScoreRankUp : styles.loveScoreRankDown;
  const rankClass = isPositive ? styles.rankUp : styles.rankDown;
  const sizeClass =
    size === "small" ? styles.loveScoreSmall : size === "large" ? styles.loveScoreLarge : styles.loveScoreMedium;
  const rankSizeClass =
    size === "small" ? styles.rankSmall : size === "large" ? styles.rankLarge : styles.rankMedium;

  return (
    <div
      className={clsx(styles.loveScore, loveScoreClass, sizeClass, className)}
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? 'scale(1)' : 'scale(0.9)',
        pointerEvents: visible ? 'auto' : 'none'
      }}
    >
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
