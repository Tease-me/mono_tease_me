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
      <div className={styles.upper}>
        <div className={styles.balanceBadge}>
          ${balance}
        </div>
        <h3>{name}</h3>
        <p>Last Connected: <span className={styles.lastConnected} >{lastConnected} </span></p>
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
            <span className={styles.stage}>Talking</span>
          </div>
        </div>
      </div>


    </div>
  );
}

export default InfluencerRelationCard;