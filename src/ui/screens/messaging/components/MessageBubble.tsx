import React, { useLayoutEffect, useRef, useState } from 'react';
import styles from "./MessageBubble.module.css"
import clsx from 'clsx';
import TypingIndicator from './TypingIndicator';
import { MediaAttachment, Message } from '@/data/models/MessageDataModel';
import AudioPlayer from '@/ui/components/audio-player/AudioPlayer';

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

const MessageBubble: React.FC<MessageBubbleProps> = ({
    msg,
    callGroup,
    influencerName,
    onAudioPlay,
    showAudioTranscript,
}) => {
    const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
    const [expanded, setExpanded] = useState(false);
    const [transcriptExpanded, setTranscriptExpanded] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    useLayoutEffect(() => {
        function updateSize() {
            if (!containerRef.current) return;
            const { width, height } = containerRef.current.getBoundingClientRect();
            setDimensions({ width: width, height: height });
        }
        updateSize();
        window.addEventListener('resize', updateSize);
        return () => window.removeEventListener('resize', updateSize);
    }, [containerRef]);

    const getAudioUrl = (attachment: MediaAttachment): string => {
        if (attachment.blob)
            return URL.createObjectURL(attachment.blob);
        if (attachment.audioUrl)
            return attachment.audioUrl;
        return "";
    }

    const renderAttachments = (message?: Message) => {
        if (!message?.attachments) return null;
        return message.attachments.map((attachment, idx) =>
            attachment.type === 'audio' ? (
                <AudioPlayer
                    key={idx}
                    src={getAudioUrl(attachment)}
                    height={dimensions.height}
                    width={dimensions.width}
                    progressColor={(message.sender ?? "received") === "received" ? '#FF8395' : "#FF981F"}
                    onPlay={onAudioPlay}
                />
            ) : null
        );
    };

    if (!msg && !callGroup) {
        return <div className={clsx(styles["message"], styles["received"])}>
            <TypingIndicator />
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
            className={clsx(styles["message"], styles[sender], isAudioOnly && styles["audio-only"])}
        >
            <div className={clsx(styles["message-content"], callGroup && styles["call-transcript"])}>
                {callGroup ? (
                    <>
                        <div className={styles["call-transcript-header"]}>
                            <div className={styles["call-title"]}>Call log</div>
                            <button
                                type="button"
                                className={styles["call-toggle"]}
                                onClick={() => setExpanded((prev) => !prev)}
                            >
                                {expanded ? "Hide" : "Show"}
                            </button>
                        </div>
                        {callDuration && (
                            <div className={styles["call-duration"]}>Total call time: {callDuration}</div>
                        )}
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
                        {hasTranscript && (
                            <button
                                type="button"
                                className={styles["audio-transcript-toggle"]}
                                onClick={() => setTranscriptExpanded((prev) => !prev)}
                            >
                                {transcriptExpanded ? "Hide transcript" : "Show transcript"}
                            </button>
                        )}
                        {hasTranscript && transcriptExpanded && (
                            <div className={styles["audio-transcript"]}>{msg?.transcript}</div>
                        )}
                    </>
                )}
            </div>
            {!callGroup && <span className={styles["time"]}>{time}</span>}
        </div>
    );
};

export default MessageBubble;
