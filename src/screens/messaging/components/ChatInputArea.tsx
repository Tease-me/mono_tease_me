import React from 'react';


import CircularIconButton from '@/components/buttons/CircularIconButton';
import CallIcon from "@/assets/Call.svg?react";
import MicrophoneIcon from "@/assets/Microphone.svg?react";
import SendIcon from "@/assets/Send.svg?react";

import styles from "./ChatInputArea.module.css"

interface ChatInputAreaProps extends React.HTMLAttributes<HTMLDivElement> {
    onSendMessage?: () => void;
    inputText?: string;
    setInputText?: (text: string) => void;
}

const ChatInputArea: React.FC<ChatInputAreaProps> = ({ onSendMessage, inputText, setInputText }) => {
    return (
        <div className={styles["chat-input-area"]}>
            <input
                type="text"
                placeholder="Message..."
                value={inputText}
                onChange={(e) => setInputText && setInputText(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && onSendMessage && onSendMessage()}
            />
            <CircularIconButton icon={<CallIcon />} className={styles["call-btn"]} onClick={() => alert("Camera clicked")} size="small" />
            <CircularIconButton icon={<MicrophoneIcon />} className={styles["voice-btn"]} onClick={() => alert("Camera clicked")} size="small" variant="secondary" />
            <CircularIconButton icon={<SendIcon />} className={styles["send-btn"]} onClick={onSendMessage} size="small" />
        </div>
    );
};

export default ChatInputArea;