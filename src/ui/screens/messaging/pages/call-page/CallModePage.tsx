import ProfileMedia from "@/ui/components/ProfileMedia";
import IconButton from "@/ui/components/inputs/buttons/IconButton";
import InfluencerMetrics from "@/ui/components/stats/InfluencerMetrics";
import { RelationshipDataModel } from "@/data/models/RelationshipDataModel";
import { InfluencerDataModel } from "@/data/models/InfluencerDataModel";

import styles from "./CallModePage.module.css";
import BalanceBadge from "@/ui/components/stats/BalanceBadge";
import LoveScore from "../../components/LoveScore";
import { CallStatus } from "@/hooks/useCallWebRTC";
import SvgPack from "@/utils/SvgPack";
import { formatTime } from "@/utils/time";
import clsx from "clsx";
import React, { useEffect } from "react";
import { getRelationshipStatusIcon, RelationshipStatus } from "@/utils/relationshipStatusIcons";
import { BalanceServices } from "@/api/services/BalanceServices";
import { apiClient } from "@/api/apis";
import { formatDateTimeRelative } from "@/utils/DateTimeUtils";

const balanceSvc = BalanceServices(apiClient);

type CallModePageProps = {
    startConversation?: () => void;
    stopConversation?: () => void;
    status?: CallStatus;
    timeRemaining?: number | null;
    micMute?: boolean;
    influencer?: InfluencerDataModel;
    relationship?: RelationshipDataModel;
    toggleMute?: () => void;
};

const CallModePage = ({ influencer, relationship, startConversation, stopConversation, status, timeRemaining }: CallModePageProps) => {
    const [balance, setBalance] = React.useState<number>(0);

    const handleCallButtonClicked = () => {
        if (status === "idle" || status === "disconnected") {
            startConversation?.();
        } else if (status === "connected") {
            stopConversation?.();
        }
    }
    useEffect(() => {
        if (influencer?.id) {
            balanceSvc.getBalance(influencer?.id).then((balance) => {
                setBalance(balance.balance_cents / 100);
            });
        }
    }, [influencer]);

    return (
        <div className={styles.page}>
            <div className={styles.card}>
                <BalanceBadge balance={balance} />
                <ProfileMedia active size="xlarge" mediaType="image" videoSrc={influencer?.videoUrl} imageSrc={influencer?.img} glow />
                <div className={styles.name}>{influencer?.name}</div>

                <div className={styles.statsRow}>
                    <div className={styles.statCard}>
                        <div className={styles.statLabel}>Love</div>
                        <div className={styles.statValue}>
                            <LoveScore rankPosition="left" sentimentScore={relationship?.sentiment_score || 0} size="large" />
                        </div>
                    </div>
                    <div className={styles.statCard}>
                        <div className={styles.statLabel}>Status</div>
                        <div className={styles.statValue}>
                            <span className={styles.statIcon}>
                                {getRelationshipStatusIcon(relationship?.state as RelationshipStatus)}
                            </span>
                            {relationship?.state || 'N/A'}
                        </div>
                    </div>
                </div>
                <div className={styles.cardButtom}>
                    <InfluencerMetrics relationship={relationship} className={styles.metrics} />

                    {status === "connected" ? (
                        <div className={clsx(styles.connectionStatus, styles.connected)}>
                            Connected <span>{timeRemaining && formatTime(timeRemaining)}</span>
                        </div>
                    ) : status === "connecting" ? (
                        <div className={clsx(styles.connectionStatus, styles.connecting)}>
                            <span>Ringing...</span>
                        </div>
                    ) : (
                        <div className={clsx(styles.connectionStatus, styles.lastConnected)}>
                            Last Connected: <span>{relationship?.last_interaction_at ? formatDateTimeRelative(relationship?.last_interaction_at) : "Never"}</span>
                        </div>
                    )}
                    <IconButton className={styles.callButton} color={status === "connected" ? "red" : "green"} type="pill" leftIcon={status === "connected" ? <SvgPack.HangupCallIcon /> : <SvgPack.Call />} onClick={handleCallButtonClicked} />
                </div>
            </div>
        </div>
    );
};

export default CallModePage;
