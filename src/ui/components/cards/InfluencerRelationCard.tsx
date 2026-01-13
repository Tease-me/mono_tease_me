import React from "react";
import styles from "./InfluencerRelationCard.module.css";
import SvgPack from "@/utils/SvgPack";
import ProfileMedia from "../ProfileMedia";
import MetricRing from "../stats/MetricRing";
import { formatDateTimeRelative } from "@/utils/DateTimeUtils";
import BalanceBadge from "../stats/BalanceBadge";

type InfleuncerRelationCardProps = {
  name: string;
  image: string;
  video: string
  balance: number;
  lastConnected: string;
  loveScore: number;
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
  loveScore,
  status,
  trust,
  safety,
  attraction,
  closeness,
}) => {
  const metrics = [
    { key: "trust", label: "Trust", value: trust, icon: <SvgPack.Trust /> },
    { key: "attraction", label: "Attraction", value: attraction, icon: <SvgPack.Angles /> },
    { key: "closeness", label: "Closeness", value: closeness, icon: <SvgPack.KissGray /> },
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



  return (
    <div className={styles.card}>
      <div className={styles.upper}>
        <div className={styles.balanceBadge}>
         <BalanceBadge balance={balance} />
        </div>
        <div className={styles.nameArea}>
          <h3>{name}</h3>
          <p className={styles.lastConnectedArea}>Last Connected: <span className={spanClass} >{isActive ? "Active Now" : lastConnectedLabel} </span></p>
        </div>
        <div className={styles.avatarContainer}>
          <ProfileMedia size={'xlarge'} imageSrc={image} videoSrc={video} active />
        </div>
        <div className={styles.metricsBridge}>
          <div className={styles.metricsArea}>
            {metrics.map(({ key, label, value, icon }) => (
              <MetricRing key={key} icon={icon} label={label} value={value} />
            )
            )}
          </div>
        </div>
      </div>
      <div className={styles.lower}>
        <div className={styles.stat}>
          <span className={styles.label}>Love</span>
          <div className={styles.valueRow}>
            <span className={styles.value}>{loveScore}</span>
          </div>
        </div>
        <div className={styles.stat}>
          <span className={styles.label}>Status</span>
          <div className={styles.valueRow}>
            <div className={styles.stageArea}>
              <span className={styles.stage}>{status}</span>
            </div>
          </div>
        </div>
      </div>


    </div>
  );
}

export default InfluencerRelationCard;