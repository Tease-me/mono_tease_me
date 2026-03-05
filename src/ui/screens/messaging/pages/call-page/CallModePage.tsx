import ProfileMedia from "@/ui/components/ProfileMedia";
import IconButton from "@/ui/components/inputs/buttons/IconButton";
import InfluencerMetrics from "@/ui/components/stats/InfluencerMetrics";
import { RelationshipDataModel } from "@/data/models/RelationshipDataModel";
import { InfluencerDataModel } from "@/data/models/InfluencerDataModel";
import { Suspense } from "react";

import styles from "./CallModePage.module.css";
import BalanceBadge from "@/ui/components/stats/BalanceBadge";
import LoveScore from "../../components/LoveScore";
import { CallStatus } from "@/hooks/useCallWebRTC";
import SvgPack from "@/utils/SvgPack";
import { formatTime } from "@/utils/time";
import clsx from "clsx";
import React, { useEffect, useRef, useState } from "react";
import { getRelationshipStatusIcon, getRelationshipStatusLabel, RelationshipStatus } from "@/utils/relationshipStatusUtils";
import { BalanceServices } from "@/api/services/BalanceServices";
import { apiClient } from "@/api/apis";
import { formatDateTimeRelative, formatDate } from "@/utils/DateTimeUtils";
import switchProfileImg from "@/assets/svg/switchProfile.svg";
import InfluencerPopup from "../../components/InfluencerPopup";
import { RelationshipServices } from "@/api/services/RelationshipServices";
import { useIsMobile } from "@/hooks/layout/useIsDesktop";

const balanceSvc = BalanceServices(apiClient);
const relationshipService = RelationshipServices(apiClient);

type CallModePageProps = {
    startConversation?: () => void;
    stopConversation?: () => void;
    status?: CallStatus;
    callTime?: number | null;
    micMute?: boolean;
    influencer?: InfluencerDataModel;
    relationship?: RelationshipDataModel;
    toggleMute?: () => void;
    errorMessage?: string;
    cancelCall?: () => void;
    onChangeInfluencer?: () => void;
    conversationId?: string | null;
};

const CallModePage = ({ influencer, relationship, startConversation, stopConversation, status, errorMessage, cancelCall, onChangeInfluencer, conversationId }: CallModePageProps) => {
    const [balance, setBalance] = React.useState<number>(0);
    const [isPopupOpen, setIsPopupOpen] = useState(false);
    const [nextStage, setNextStage] = useState<string>("");
    const [callSummary, setCallSummary] = useState<{ durationSecs: number; } | null>(null);
    const activeConversationIdRef = useRef<string | null>(null);
    const lastCallDurationRef = useRef<number>(0);

    const handleCallButtonClicked = () => {
        if (status === "connected") {
            stopConversation?.();
        } else if (status === "connecting") {
            cancelCall?.();
        } else {
            startConversation?.();
        }
    }
    useEffect(() => {
        if (influencer?.id) {
            balanceSvc.getBalance(influencer?.id).then((balance) => {
                setBalance(balance.balance_cents / 100);
            });
        }
    }, [influencer]);

    useEffect(() => {
        if (!influencer?.id) {
            setNextStage("");
            return;
        }

        let cancelled = false;
        (async () => {
            try {
                const dims = await relationshipService.getDimensions(influencer.id);
                if (!cancelled) {
                    setNextStage(dims.next_stage);
                }
            } catch {
                if (!cancelled) {
                    setNextStage("");
                }
            }
        })();

        return () => { cancelled = true; };
    }, [influencer?.id, relationship?.trust, relationship?.closeness, relationship?.attraction, relationship?.safety]);
    const getButtonIcon = () => {
        if (status === "connected") {
            return <Suspense fallback={null}><SvgPack.HangupCallIcon /></Suspense>;
        } else if (status === "connecting") {
            return <Suspense fallback={null}><SvgPack.HangupCallIcon /></Suspense>;
        } else {
            return <Suspense fallback={null}><SvgPack.Call /></Suspense>;
        }
    }
    const getButtonColor = () => {
        if (status === "connected") {
            return "red";
        } else if (status === "connecting") {
            return "red";
        } else {
            return "green";
        }
    };

    const handleOpenPopup = () => {
        setIsPopupOpen(true);
    };

    const handleClosePopup = () => {
        setIsPopupOpen(false);
    };

    const isMobile = useIsMobile();
    const showBalance = false;
    const [showCallTime, setShowCallTime] = useState(0);

    useEffect(() => {
        const isActive = status === "connecting" || status === "connected";

        if (!isActive) {
            setShowCallTime(0);
            return;
        }

        const interval = setInterval(() => {
            setShowCallTime((prev) => {
                const next = prev + 1;
                lastCallDurationRef.current = next;
                return next;
            });
        }, 1000);

        return () => clearInterval(interval);
    }, [status]);

    useEffect(() => {
        if (status === "connected" && conversationId) {
            activeConversationIdRef.current = conversationId;
        }


        if ((status === "idle" || status === "disconnected") && activeConversationIdRef.current) {
            activeConversationIdRef.current = null;
            const secs = lastCallDurationRef.current;
            lastCallDurationRef.current = 0;
            if (secs > 0) {
                setCallSummary({ durationSecs: secs });
            }
        }

        if (status === "connecting") {
            setCallSummary(null);
        }
    }, [status, conversationId]);


    return (
        <div className={styles.page}>
            <div className={styles.cardCaller}>
                {showBalance ? <BalanceBadge balance={balance} /> : <div style={{ height: "32px" }}></div>}
                <div className={styles.profileWrap}>
                    <div onClick={handleOpenPopup} className={styles.profileImageClick}>
                        <ProfileMedia active size={isMobile ? "large" : "xlarge"} mediaType="image" videoSrc={influencer?.videoUrl} imageSrc={influencer?.img} glow />
                    </div>
                    {onChangeInfluencer && <button
                        type="button"
                        className={styles.profileSwitch}
                        onClick={onChangeInfluencer}
                        aria-label="Change influencer"
                    >
                        <img src={switchProfileImg} alt="Switch" /> <div className={styles.switchProfileLabel}>Switch Influencer</div>
                    </button>}
                </div>
                <div className={styles.name}>{influencer?.name}</div>

                <div className={styles.statsRow}>
                    <div className={styles.statCard}>
                        <div className={styles.statLabel}>Feelings</div>
                        <div className={styles.statValue}>
                            <LoveScore rankPosition="left" sentimentDelta={relationship?.sentiment_delta} size="large" />
                        </div>
                    </div>
                    <div className={styles.statCard}>
                        <div className={styles.statLabel}>Status</div>
                        <div className={styles.statValue}>
                            <span className={styles.statIcon}>
                                {getRelationshipStatusIcon(relationship?.state as RelationshipStatus)}
                            </span>
                            {getRelationshipStatusLabel(relationship?.state as RelationshipStatus)}
                        </div>
                    </div>
                </div>
                <div className={styles.cardButtom}>
                    <InfluencerMetrics relationship={relationship} className={styles.metrics} />

                    {status === "connected" ? (
                        <div className={clsx(styles.connectionStatus, styles.connected)}>
                            Connected <span>{formatTime(showCallTime ?? 0)}</span>
                        </div>
                    ) : status === "connecting" ? (
                        <div className={clsx(styles.connectionStatus, styles.connected, styles.connecting)}>
                            Ringing...
                            <span>{formatTime(showCallTime ?? 0)}</span>
                        </div>
                    ) : status === "error" ? (
                        <div className={clsx(styles.connectionStatus, styles.error)}>
                            <span>{errorMessage}</span>
                        </div>
                    ) : (
                        <div className={clsx(styles.connectionStatus, styles.lastConnected)}>
                            <div>Last Connected: <span>{relationship?.last_interaction_at ? formatDateTimeRelative(relationship?.last_interaction_at) : "Never"}</span></div>
                            {callSummary && (status === "disconnected" || status === "idle") && (
                                <div>Last Call: <span>{formatTime(callSummary.durationSecs)}</span></div>
                            )}
                        </div>
                    )}
                    <IconButton className={styles.callButton} color={getButtonColor()} type="pill" leftIcon={getButtonIcon()} onClick={handleCallButtonClicked} />
                </div>
            </div>

            <InfluencerPopup
                isOpen={isPopupOpen}
                onClose={handleClosePopup}
                influencerData={
                    influencer
                        ? {
                            name: influencer.name || "",
                            image: influencer.img || "",
                            lastConnected: formatDate(relationship?.last_interaction_at),
                            followingSince: formatDate(influencer.created_at),
                            isSubscribed: false,
                            sentimentScore: relationship?.sentiment_score ?? 0,
                            currentStage: relationship?.state ?? "",
                            nextStage: nextStage,
                            trust: relationship?.trust,
                            closeness: relationship?.closeness,
                            attraction: relationship?.attraction,
                            safety: relationship?.safety,
                        }
                        : undefined
                }
            />
        </div>
    );
};

export default CallModePage;
