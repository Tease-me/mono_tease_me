import React, { useLayoutEffect, useRef, useState } from 'react';
import styles from "./MessageBubble.module.css"
import clsx from 'clsx';
import TypingIndicator from './TypingIndicator';
import { MediaAttachment, Message } from '@/data/models/MessageDataModel';
import AudioPlayer from '@/ui/components/audio-player/AudioPlayer';
import callIcon from "@/assets/svg/Call.svg";
import { useAudioDuration } from '@/hooks/useAudioDuration';
import { formatAudioDuration } from '@/utils/time';

export interface CallMessageGroup {
    type: 'call-group';
    id: string;
    sender: Message["sender"];
    time: string;
    messages: Message[];
}

interface MessageBubbleProps {
    msg?: Message;
    callGroup?: CallMessageGroup;
    influencerName?: string;
    onAudioPlay?: (src: string) => void;
    showAudioTranscript?: boolean;
    isAudio?: boolean;
    onCallBack?: () => void;
}

const formatDuration = (ms: number) => {
    const totalSeconds = Math.max(0, Math.floor(ms / 1000));
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    if (hours > 0) {
        return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
    }
    return `${minutes}:${String(seconds).padStart(2, "0")}`;
};

const getCallDuration = (group?: CallMessageGroup) => {
    if (!group) return undefined;
    const timestamps = group.messages
        .map((m) => m.timestamp)
        .filter((t): t is number => typeof t === "number");
    if (!timestamps.length) return undefined;

    const start = Math.min(...timestamps);
    const end = Math.max(...timestamps);
    if (end < start) return undefined;
    return formatDuration(end - start);
};

const MessageBubble: React.FC<MessageBubbleProps> = React.memo(({
    msg,
    callGroup,
    influencerName,
    onAudioPlay,
    showAudioTranscript,
    isAudio = false,
    onCallBack,
}) => {
    const [expanded, setExpanded] = useState(false);
    const [transcriptExpanded, setTranscriptExpanded] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);
    const objectUrlMapRef = useRef<Map<Blob, string>>(new Map());

    const audioAttachment = msg?.attachments?.find(a => a.type === 'audio');

    useLayoutEffect(() => {
        return () => {
            objectUrlMapRef.current.forEach((url) => {
                URL.revokeObjectURL(url);
            });
            objectUrlMapRef.current.clear();
        };
    }, []);

    const getAudioUrl = (attachment: MediaAttachment): string => {
        if (attachment.audioUrl) {
            return attachment.audioUrl;
        }
        if (attachment.blob) {
            const cachedUrl = objectUrlMapRef.current.get(attachment.blob);
            if (cachedUrl) return cachedUrl;
            const url = URL.createObjectURL(attachment.blob);
            objectUrlMapRef.current.set(attachment.blob, url);
            return url;
        }
        return "";
    }

    const audioUrl = audioAttachment ? getAudioUrl(audioAttachment) : '';
    const audioDuration = useAudioDuration(audioUrl);

    const renderAttachments = (message?: Message) => {
        if (!message?.attachments) return null;
        return message.attachments.map((attachment, idx) =>
            attachment.type === 'audio' ? (
                <AudioPlayer
                    key={idx}
                    width={150}
                    height={50}
                    src={getAudioUrl(attachment)}
                    progressColor={(message.sender ?? "received") === "received" ? '#FF8395' : "#FF981F"}
                    onPlay={onAudioPlay}
                />
            ) : null
        );
    };

    if (!msg && !callGroup) {
        return <div className={clsx(styles["message"], styles["received"])}>
            <TypingIndicator isAduio={isAudio} />
        </div>
    }
    const sender = callGroup?.sender ?? msg?.sender ?? "received";
    const time = callGroup?.time ?? msg?.time ?? "";
    const callDuration = getCallDuration(callGroup);
    const hasTranscript = Boolean(showAudioTranscript && msg?.transcript);
    const hasAudio = !callGroup && msg?.attachments?.some((attachment) => attachment.type === "audio");
    const isAudioOnly = Boolean(hasAudio && !msg?.text?.trim());
    const callSpeakerName = (messageSender: Message["sender"]) => {
        if (messageSender === "received") return influencerName || "Influencer";
        return "You";
    };


    return (
        <div
            ref={containerRef}
            className={clsx(
                styles["message"],
                styles[sender],
                isAudioOnly && styles["audio-only"],
                callGroup && styles["call-message"]
            )}
        >
            <div className={clsx(styles["message-content"], callGroup && styles["call-transcript"])}>
                {callGroup ? (
                    <>
                        <div
                            className={styles["call-bubble"]}
                            role="button"
                            tabIndex={0}
                            onClick={() => onCallBack?.()}
                            onKeyDown={(e) => {
                                if (e.key === "Enter" || e.key === " ") {
                                    e.preventDefault();
                                    onCallBack?.();
                                }
                            }}
                        >
                            <div className={styles["call-icon-wrap"]}>
                                <img src={callIcon} className={styles["call-icon"]} alt="Call" />
                            </div>
                            <div className={styles["call-copy"]}>
                                <div className={styles["call-title"]}>Phone Call</div>
                                <div className={styles["call-subtitle"]}>Tap to call back</div>
                                {(callDuration || time) && (
                                    <div className={styles["call-meta"]}>
                                        {callDuration ? `Duration ${callDuration}` : null}
                                        {callDuration && time ? " • " : ""}
                                        {time || null}
                                    </div>
                                )}
                            </div>
                        </div>
                        <button
                            type="button"
                            className={styles["call-transcript-link"]}
                            onClick={() => setExpanded((prev) => !prev)}
                        >
                            {expanded ? "Hide transcription" : "Or view transcription"}
                        </button>
                        {expanded && (
                            <div className={styles["call-lines"]}>
                                {callGroup.messages.map((message) => (
                                    <div key={message.id} className={styles["call-line"]}>
                                        <div className={styles["call-line-header"]}>
                                            <span className={styles["call-speaker"]}>{callSpeakerName(message.sender)}</span>
                                        </div>
                                        <div className={styles["call-line-bubble"]}>
                                            {message.text && <div className={styles["call-text"]}>{message.text}</div>}
                                            {renderAttachments(message)}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </>
                ) : (
                    <>
                        {msg?.text}
                        {renderAttachments(msg)}
                    </>
                )}
            </div>
            <div className={styles["message-meta"]}>
                {hasTranscript && (
                    <button
                        type="button"
                        className={styles["audio-transcript-toggle"]}
                        onClick={() => setTranscriptExpanded((prev) => !prev)}
                    >
                        {transcriptExpanded ? "Hide transcript" : "Show transcript"}
                    </button>
                )}
                {!callGroup && audioAttachment ? (
                    <span className={styles["time"]}>{formatAudioDuration(audioDuration)}</span>
                ) : (
                    !callGroup && <span className={styles["time"]}>{time}</span>
                )}
                {/* {!callGroup && <span className={styles["time"]}>{time}</span>} */}
            </div>
            {hasTranscript && transcriptExpanded && (
                <div className={styles["audio-transcript"]}>{msg?.transcript}</div>
            )}
        </div>
    );
});

export default MessageBubble;
