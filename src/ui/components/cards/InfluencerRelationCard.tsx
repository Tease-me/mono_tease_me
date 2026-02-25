import React from "react";
import styles from "./InfluencerRelationCard.module.css";
import SvgPack from "@/utils/SvgPack";
import ProfileMedia from "../ProfileMedia";
import MetricRing from "../stats/MetricRing";
import { formatDateTimeRelative } from "@/utils/DateTimeUtils";
import BalanceBadge from "../stats/BalanceBadge";
import { getRelationshipStatusIcon } from "@/utils/relationshipStatusUtils";
import { useIsMobile } from "@/utils/hooks/useIsDesktop";

type InfleuncerRelationCardProps = {
  name: string;
  image: string;
  video: string
  balance: number;
  lastConnected: string;
  status: string;
  trust: number;
  safety: number;
  attraction: number;
  closeness: number;
};


const InfluencerRelationCard: React.FC<InfleuncerRelationCardProps> = ({
  name,
  image,
  video,
  balance,
  lastConnected,
  status,
  trust,
  safety,
  attraction,
  closeness,
}) => {
  const metrics = [
    { key: "trust", label: "Trust", value: trust, icon: <SvgPack.Trust /> },
    { key: "closeness", label: "Closeness", value: closeness, icon: <SvgPack.Angles /> },
    { key: "attraction", label: "Attraction", value: attraction, icon: <SvgPack.KissGray /> },
    { key: "safety", label: "Safety", value: safety, icon: <SvgPack.Shield /> },
  ];

  const isActive = (() => {
    if (!lastConnected) return false;
    const diffMs = Date.now() - new Date(lastConnected).getTime();
    const diffMinutes = diffMs / 1000 / 60;
    return diffMinutes <= 5;
  })();
  const lastConnectedLabel = formatDateTimeRelative(lastConnected);
  const spanClass = `${styles.lastConnected} ${isActive ? styles.lastConnectedActive : ''}`;
  ` `
  const isMobile = useIsMobile();


  return (
    <div className={styles.influencerRelationCard}>
      <div className={styles.upper}>
        <div className={styles.balanceBadge}>
          <BalanceBadge balance={balance} />
        </div>
        <div className={styles.nameArea}>
          <h3>{name}</h3>
          <p className={styles.lastConnectedArea}>Last Connected: <span className={spanClass} >{lastConnected ? (isActive ? "Just Now" : lastConnectedLabel) : "--"} </span></p>
        </div>
        <div className={styles.avatarContainer}>
          <ProfileMedia size={isMobile ? 'large' : 'xlarge'} imageSrc={image} videoSrc={video} active glow />
        </div>
        <div className={styles.metricsContainer}>
          <div className={styles.metricsBridge}>

            <div className={styles.metricsArea}>
              {metrics.map(({ key, label, value, icon }) => (
                <MetricRing key={key} icon={icon} label={label} value={value} size="medium" />
              )
              )}
            </div>
          </div>
        </div>
      </div>
      <div className={styles.lower}>
        <div className={styles.stat}>
          <span className={styles.label}>Status</span>
          <div className={styles.stageArea}>
            {getRelationshipStatusIcon(status)} <span className={styles.stage}>{status}</span>
          </div>
        </div>
      </div>


    </div>
  );
}

export default InfluencerRelationCard;