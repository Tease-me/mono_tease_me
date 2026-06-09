import React from 'react';

import SendIcon from "@/assets/svg/Send.svg?react";
import styles from "./ChatInputArea.module.css"
import clsx from 'clsx';
import IconButton from '@/ui/components/inputs/buttons/IconButton';
import useIsDesktop from '@/hooks/layout/useIsDesktop';
import RemainingCreditBadge from '@/ui/components/badges/RemainingCreditBadge';
import { usePostHog } from '@posthog/react';

interface ChatInputAreaProps extends React.HTMLAttributes<HTMLDivElement> {
    onSendMessage?: (forcedAudio?: Blob) => boolean | void;
    inputText?: string;
    setInputText?: (text: string) => void;
    inputAudio?: Blob;
    setInputAudio?: (blob?: Blob) => void;
    error?: string;
    disabled?: boolean;
    creditsRemaining?: number;
}

const ChatInputArea: React.FC<ChatInputAreaProps> = ({
    onSendMessage,
    inputText,
    setInputText,
    inputAudio,
    setInputAudio,
    error,
    disabled = false,
    creditsRemaining }) => {
    const isDesktop = useIsDesktop();
    const posthog = usePostHog();

    const handleOnChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        e.preventDefault();
        if (setInputText) {
            setInputText(e.target.value);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === "Enter" && onSendMessage) {
            e.preventDefault();
            onSendMessage();
        }
    };

    const handleOnSendMessage = () => {
        if ((inputText && inputText.trim() !== '') || inputAudio) {
            const didSend = onSendMessage?.();
            if (didSend === false) {
                return;
            }
            posthog?.capture("message_sent", {
                message_type: inputAudio ? "audio" : "text",
            });
        }
        setInputText?.("");
        setInputAudio?.(undefined);
    }

    return (
        <div className={styles["chat-input-area"]}>
            <div className={clsx(styles["input-container"], error && styles["error"])}>
                {error && <div className={styles["error-message"]}>{typeof error === 'string' ? error : 'An error occurred'}</div>}
                {!error &&
                    <div className={styles["input-with-badge"]}>
                        <input
                            name='message-input-box'
                            type="text"
                            placeholder="Message..."
                            value={inputText}
                            onChange={handleOnChange}
                            onKeyDown={handleKeyDown}
                            disabled={disabled}
                            maxLength={300}
                        />
                        <RemainingCreditBadge className={styles["credit-badge"]} value={creditsRemaining || 0} />
                    </div>}
            </div>

            <div className={styles["buttons"]}>
                <IconButton
                    color='black'
                    text={isDesktop ? "Send" : ""}
                    leftIcon={<SendIcon />}
                    className={styles["send-btn"]}
                    onClick={handleOnSendMessage}
                    disabled={disabled}
                />
            </div>
        </div>
    );
};

export default ChatInputArea;
