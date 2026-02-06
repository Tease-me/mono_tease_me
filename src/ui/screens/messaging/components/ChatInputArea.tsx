import React, { useEffect, useRef, useState, useLayoutEffect } from 'react';

import SendIcon from "@/assets/svg/Send.svg?react";
import styles from "./ChatInputArea.module.css"
import AudioVisualizer from './AudioVisualizer';
import AudioWaveform from './AudioWaveform';
import LongPressButton from '@/ui/components/inputs/buttons/LongPressButton';
import { useAudioRecorder } from '@/hooks/useAudioRecorder';
import clsx from 'clsx';
import IconButton from '@/ui/components/inputs/buttons/IconButton';
import SvgPack from '@/utils/SvgPack';
import useIsDesktop from '@/utils/hooks/useIsDesktop';
import RemainingCreditBadge from '@/ui/components/badges/RemainingCreditBadge';

interface ChatInputAreaProps extends React.HTMLAttributes<HTMLDivElement> {
    adultMode?: boolean;
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
    adultMode = false,
    onSendMessage,
    inputText,
    setInputText,
    inputAudio,
    setInputAudio,
    error,
    disabled = false,
    creditsRemaining }) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
    const { startRecording, stopRecording, recordingStatus, audio, streamRef, clearAudio } = useAudioRecorder();
    const [sendOnStop, setSendOnStop] = useState(false);
    const [isCancelling, setIsCancelling] = useState(false);
    const [showViz, setShowViz] = useState(false);
    const isDesktop = useIsDesktop();
    const [voiceMode, setVoiceMode] = useState(true);

    useLayoutEffect(() => {
        function updateSize() {
            if (!containerRef.current) return;
            const { width, height } = containerRef.current.getBoundingClientRect();
            setDimensions({ width: Math.floor(width), height: Math.floor(height) });
        }
        updateSize();
        window.addEventListener('resize', updateSize);
        return () => window.removeEventListener('resize', updateSize);
    }, []);

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
        }
        setInputText?.("");
        setInputAudio?.(undefined);
        clearAudio();
    }

    const handleOnShortPress = () => {
        if (inputAudio) {
            setInputAudio?.(undefined);
            clearAudio();
        } else {
            setInputText?.("");
        }
    };

    useEffect(() => {
        if (audio && isCancelling) {
            clearAudio();
            return;
        }
        if (audio && sendOnStop) {
            const didSend = onSendMessage?.(audio);
            setSendOnStop(false);
            if (didSend === false) {
                return;
            }
            clearAudio();
        }
    }, [audio, sendOnStop, isCancelling, onSendMessage, clearAudio]);

    const handleOnLongPressStart = () => {
        setIsCancelling(false);
        setShowViz(true);
        if (audio) {
            setInputAudio?.(undefined);
            clearAudio();
        }
        document.querySelectorAll('audio').forEach(el => (el as HTMLAudioElement).pause());
        startRecording();
    }

    const handleOnLongPressEnd = () => {
        setShowViz(false);
        setSendOnStop(true);
        stopRecording();
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(t => t.stop());
            streamRef.current = null;
        }
    }

    const handleCancelRecording = () => {
        setShowViz(false);
        setIsCancelling(true);
        setSendOnStop(false);
        stopRecording();
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(t => t.stop());
            streamRef.current = null;
        }
        clearAudio();
        setInputAudio?.(undefined);
    };

    const handleOnMessageModeClicked = () => {
        setVoiceMode(prev => !prev);
    }

    return (
        <div className={clsx(styles["chat-input-area"], voiceMode && styles["voice"])} >
            {!(adultMode && voiceMode) && <div className={clsx(styles["input-container"], recordingStatus === "recording" && styles["recording"], error && styles["error"])} ref={containerRef}>
                {error && <div className={styles["error-message"]}>{error}</div>}
                {!error && (recordingStatus === "inactive" && !audio) &&
                    <div className={styles["input-with-badge"]}>
                        <input
                            name='message-input-box'
                            type="text"
                            placeholder="Message..."
                            value={inputText}
                            onChange={handleOnChange}
                            onKeyDown={handleKeyDown}
                            disabled={disabled}
                        />
                        <RemainingCreditBadge className={styles["credit-badge"]} value={creditsRemaining || 0} />
                    </div>}
                {audio && !sendOnStop && !isCancelling && (
                    <AudioWaveform audioBlob={audio}
                        width={dimensions.width}
                        height={dimensions.height} />
                )}
                {(recordingStatus === "recording" && streamRef.current && showViz) && (
                    <AudioVisualizer
                        mediaStream={streamRef.current}
                        speed={1}
                        isRecording={recordingStatus === "recording"}
                        width={dimensions.width}
                        height={dimensions.height}
                    />
                )}
            </div>}

            <div className={clsx(styles["buttons"], (adultMode && voiceMode) && styles["voice-mode"])}>
                {(adultMode && voiceMode) && <LongPressButton
                    onShortPress={handleOnShortPress}
                    onLongPressStart={handleOnLongPressStart}
                    onLongPressEnd={handleOnLongPressEnd}
                    onDragStart={handleCancelRecording}
                    onDrag={handleCancelRecording}
                    onDragEnd={handleCancelRecording}
                    leftIcon={inputAudio ? <SvgPack.CloseSquare /> : <SvgPack.Voice />}
                    className={styles["voice-btn"]}
                    color='black'
                    text={recordingStatus === "recording" ? "Release to Send" : "Hold to Talk"}
                    disabled={disabled} />}
                {(adultMode && !voiceMode) && <IconButton
                    leftIcon={inputAudio ? <SvgPack.CloseSquare /> : <SvgPack.Voice />}
                    className={styles["voice-btn"]}
                    onClick={handleOnMessageModeClicked}
                    color='black'
                    disabled={disabled} />}
                {!(adultMode && voiceMode) && <IconButton color='black' text={isDesktop ? "Send" : ""} leftIcon={<SendIcon />} className={styles["send-btn"]} onClick={handleOnSendMessage} disabled={disabled} />}
                {(adultMode && voiceMode) && <IconButton color='black' leftIcon={<SvgPack.Chat />} className={styles["send-btn"]} onClick={handleOnMessageModeClicked} disabled={disabled} />}
            </div>
        </div>
    );
};

export default ChatInputArea;
