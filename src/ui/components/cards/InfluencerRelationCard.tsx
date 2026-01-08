import React from "react";
import styles from "./InfluencerRelationCard.module.css";
import SvgPack from "@/utils/SvgPack";
import ProfileMedia from "../ProfileMedia";
import MetricRing from "../stats/MetricRing";

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
    { key: "trust", label: "Trust", value: trust, icon: <SvgPack.Heart /> },
    { key: "safety", label: "Safety", value: safety, icon: <SvgPack.Danger /> },
    { key: "attraction", label: "Attraction", value: attraction, icon: <SvgPack.Link /> },
    { key: "closeness", label: "Closeness", value: closeness, icon: <SvgPack.Link /> },
  ];


  return (
    <div className={styles.card}>
      <div className={styles.balanceBadge}>
        ${balance}
      </div>
      <h3>{name}</h3>
      <p>Last Connected: <span className={styles.lastConnected} >{lastConnected} </span></p>
      <div className={styles.avatarContainer}>
        <ProfileMedia size={'xlarge'} imageSrc={image} videoSrc={video} active  />
      </div>

      <div className={styles.metricsArea}>
        {metrics.map(({ key, label, value, icon }) => (
          <MetricRing key={key} icon={icon} label={label} value={value} />
        )
        )}
      </div>
      <div className={styles.loveScoreArea}>
      <div className={styles.loveScoreLabel}>Love </div>
      <div className={styles.loveScoreValue}>{loveScore}</div>
      <div className={styles.statusArea}>
        <span className={styles.statusLabel}>Status: </span>
        <span className={`${styles.statusValue} ${styles[status]}`}>{status}</span>
      </div>
      </div>
    </div>
  );
}

export default InfluencerRelationCard;