import ProfileMedia from "@/ui/components/ProfileMedia";
import IconButton from "@/ui/components/inputs/buttons/IconButton";
import ChatIcon from "@/assets/svg/Chat.svg?react";
import CallIcon from "@/assets/svg/Call.svg?react";
import InfluencerMetrics from "@/ui/components/stats/InfluencerMetrics";
import { RelationshipDataModel } from "@/data/models/RelationshipDataModel";
import { InfluencerDataModel } from "@/data/models/InfluencerDataModel";

import styles from "./CallModePage.module.css";
import BalanceBadge from "@/ui/components/stats/BalanceBadge";
import LoveScore from "../../components/LoveScore";

type CallModePageProps = {
    influencer?: InfluencerDataModel;
    relationship?: RelationshipDataModel;
};

const CallModePage = ({ influencer, relationship }: CallModePageProps) => {
    return (
        <div className={styles.page}>
            <div className={styles.card}>
                <BalanceBadge balance={123.45} />
                <ProfileMedia active size="xlarge" mediaType="image" videoSrc={influencer?.videoUrl} imageSrc={influencer?.img} glow />
                <div className={styles.name}>{influencer?.name}</div>

                <div className={styles.statsRow}>
                    <div className={styles.statCard}>
                        <div className={styles.statLabel}>Love</div>
                        <div className={styles.statValue}>
                            <LoveScore sentimentScore={relationship?.sentiment_score || 0} size="large" />
                        </div>
                    </div>
                    <div className={styles.statCard}>
                        <div className={styles.statLabel}>Status</div>
                        <div className={styles.statValue}>
                            <span className={styles.statIcon}>
                                <ChatIcon />
                            </span>
                            {relationship?.state || 'N/A'}
                        </div>
                    </div>
                </div>
                <div className={styles.cardButtom}>
                    <InfluencerMetrics relationship={relationship} className={styles.metrics} />

                    <div className={styles.lastConnected}>
                        Last Connected: <span>14 Hours Ago</span>
                    </div>

                    <IconButton className={styles.callButton} color="green" type="pill" leftIcon={<CallIcon />} />
                </div>
            </div>
        </div>
    );
};

export default CallModePage;
