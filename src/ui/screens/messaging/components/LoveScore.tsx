import React, { useState, useEffect } from "react";
import clsx from "clsx";
import LottieAnimation from "@/ui/components/LottieAnimation";
import rankUp from "@/assets/lottie/rankUp.json";
import rankDown from "@/assets/lottie/rankDown.json";
import lottieHeartDefault from "@/assets/lottie/lottieHeartDefault.json";
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
  const prevSentimentDelta = React.useRef<number | null>(null);
  const renderCount = React.useRef(0);
  const hasSeenValue = React.useRef(false);

  const parsedScore = Number(sentimentDelta);
  const numericScore = Number.isFinite(parsedScore) ? parsedScore : 0;
  const isPositive = numericScore > 0;
  const displayScore = Number.isFinite(parsedScore)
    ? `${isPositive ? '+' : ''}${parsedScore.toFixed(2)}`
    : "";

  const shouldShow = Math.abs(numericScore) !== 0;

  useEffect(() => {
    renderCount.current++;
    const currentValue = sentimentDelta ?? null;
    const hasChanged = prevSentimentDelta.current !== currentValue;
    const isInitialLoad = prevSentimentDelta.current === null && currentValue !== null;

    if (currentValue !== null) {
      hasSeenValue.current = true;
    }

    const isStable = hasSeenValue.current && renderCount.current >= 2;

    prevSentimentDelta.current = currentValue;

    if (!isStable || !hasChanged || isInitialLoad) {
      return;
    }

    if (shouldShow) {
      setVisible(true);
      const timer = setTimeout(() => setVisible(false), 5000);
      return () => clearTimeout(timer);
    } else {
      setVisible(false);
    }
  }, [sentimentDelta, shouldShow]);

  const loveScoreClass = !visible
    ? styles.loveScoreNeutral
    : isPositive ? styles.loveScoreRankUp : styles.loveScoreRankDown;
  const rankClass = !visible
    ? styles.rankNeutral
    : isPositive ? styles.rankUp : styles.rankDown;
  const sizeClass =
    size === "small" ? styles.loveScoreSmall : size === "large" ? styles.loveScoreLarge : styles.loveScoreMedium;
  const rankSizeClass =
    size === "small" ? styles.rankSmall : size === "large" ? styles.rankLarge : styles.rankMedium;

  return (
    <div
      className={clsx(styles.loveScore, loveScoreClass, sizeClass, className)}
      style={{
        justifyContent: !visible ? 'center' : undefined
      }}
    >
      {rankPosition === "left" && (
        <div className={clsx(styles.rank, rankClass, rankSizeClass)}>
          <div
            className={styles.heartAnimation}
            style={{
              opacity: !visible ? 1 : 0,
              pointerEvents: !visible ? 'auto' : 'none'
            }}
          >
            <LottieAnimation autoplay loop animationData={lottieHeartDefault} />
          </div>
          <div
            className={styles.arrowAnimation}
            style={{
              opacity: visible ? 1 : 0,
              pointerEvents: visible ? 'auto' : 'none'
            }}
          >
            {isPositive ? (
              <LottieAnimation autoplay loop animationData={rankUp} />
            ) : (
              <LottieAnimation autoplay loop animationData={rankDown} />
            )}
          </div>
        </div>
      )}
      <p
        className={styles.loveScoreValue}
        style={{
          opacity: visible ? 1 : 0,
          pointerEvents: visible ? 'auto' : 'none',
          display: visible ? 'block' : 'none'
        }}
      >
        {displayScore}
      </p>
      {rankPosition === "right" && (
        <div className={clsx(styles.rank, rankClass, rankSizeClass)}>
          <div
            className={styles.heartAnimation}
            style={{
              opacity: !visible ? 1 : 0,
              pointerEvents: !visible ? 'auto' : 'none'
            }}
          >
            <LottieAnimation autoplay loop animationData={lottieHeartDefault} />
          </div>
          <div
            className={styles.arrowAnimation}
            style={{
              opacity: visible ? 1 : 0,
              pointerEvents: visible ? 'auto' : 'none'
            }}
          >
            {isPositive ? (
              <LottieAnimation autoplay loop animationData={rankUp} />
            ) : (
              <LottieAnimation autoplay loop animationData={rankDown} />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
