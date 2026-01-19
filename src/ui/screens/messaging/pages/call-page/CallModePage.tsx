import ProfileMedia from "@/ui/components/ProfileMedia";
import IconButton from "@/ui/components/inputs/buttons/IconButton";
import ChatIcon from "@/assets/svg/Chat.svg?react";
import InfluencerMetrics from "@/ui/components/stats/InfluencerMetrics";
import { RelationshipDataModel } from "@/data/models/RelationshipDataModel";
import { InfluencerDataModel } from "@/data/models/InfluencerDataModel";

import styles from "./CallModePage.module.css";
import BalanceBadge from "@/ui/components/stats/BalanceBadge";
import LoveScore from "../../components/LoveScore";
import { CallStatus } from "@/hooks/useCallWebRTC";
import SvgPack from "@/utils/SvgPack";
import { formatTime } from "@/utils/time";

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

    const statusDisplay = (() => {
        if (status === "connecting") {
            return (
                <>
                    <span className={styles.statIcon}>
                        <SvgPack.Call />
                    </span>
                    Ringing...
                </>
            );
        }
        if (status === "connected") {
            return (
                <>
                    <span className={styles.statIcon}>
                        <SvgPack.Call />
                    </span>
                    {timeRemaining && formatTime(timeRemaining)}
                </>
            );
        }
        return (
            <>
                <span className={styles.statIcon}>
                    <ChatIcon />
                </span>
                Last Connected: 14 Hours Ago
            </>
        );
    })();

    const handleCallButtonClicked = () => {
        if (status === "idle" || status === "disconnected") {
            startConversation?.();
        } else if (status === "connected") {
            stopConversation?.();
        }
    }



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
                            {statusDisplay}
                        </div>
                    </div>
                </div>
                <div className={styles.cardButtom}>
                    <InfluencerMetrics relationship={relationship} className={styles.metrics} />

                    {status === "connected" ? (
                        <div className={styles.timeRemaining}>
                            Time Remaining: <span>{timeRemaining && formatTime(timeRemaining)}</span>
                        </div>
                    ) : status === "connecting" ? (
                        <div className={styles.lastConnected}>
                            Status: <span>Ringing...</span>
                        </div>
                    ) : (
                        <div className={styles.lastConnected}>
                            Last Connected: <span>14 Hours Ago</span>
                        </div>
                    )}
                    <IconButton className={styles.callButton} color={status === "connected" ? "red" : "green"} type="pill" leftIcon={status === "connected" ? <SvgPack.HangupCallIcon /> : <SvgPack.Call />} onClick={handleCallButtonClicked} />
                </div>
            </div>
        </div>
    );
};

export default CallModePage;
