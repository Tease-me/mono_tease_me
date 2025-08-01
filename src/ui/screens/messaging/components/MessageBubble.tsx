import React, { useLayoutEffect, useRef, useState } from 'react';
import styles from "./MessageBubble.module.css"
import clsx from 'clsx';
import TypingIndicator from './TypingIndicator';
import { MediaAttachment, Message } from '@/data/models/MessageDataModel';
import AudioPlayer from '@/ui/components/audio-player/AudioPlayer';

interface MessageBubbleProps {
    msg?: Message;
}

const MessageBubble: React.FC<MessageBubbleProps> = ({ msg }) => {
    const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
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

    return (
        msg ? <div ref={containerRef} className={clsx(styles["message"], styles[msg.sender])}>
            <div className={styles["message-content"]}>
                {msg.text}
                {msg.attachments?.map((attachment, idx) =>
                    attachment.type === 'audio' ? (
                        <AudioPlayer
                            key={idx}
                            src={getAudioUrl(attachment)}
                            height={dimensions.height}
                            width={dimensions.width}
                            progressColor={msg.sender === "received" ? '#FF8395' : "#FF981F"}
                        />
                    ) : null
                )}
            </div>
            <span className={styles["time"]}>{msg.time}</span>
        </div> : <div className={clsx(styles["message"], styles["received"])}>
            <TypingIndicator />
        </div>
    );
};

export default MessageBubble;