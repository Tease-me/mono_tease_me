import React, { useEffect, useRef, useState, useLayoutEffect } from 'react';

import MicrophoneIcon from "@/assets/Microphone.svg?react";
import SendIcon from "@/assets/svg/Send.svg?react";
import CloseSquareIcon from "@/assets/CloseSquare.svg?react";
import styles from "./ChatInputArea.module.css"
import AudioVisualizer from './AudioVisualizer';
import AudioWaveform from './AudioWaveform';
import LongPressButton from '@/ui/components/inputs/buttons/LongPressButton';
import { useAudioRecorder } from '@/hooks/useAudioRecorder';
import clsx from 'clsx';
import IconButton from '@/ui/components/inputs/buttons/IconButton';

interface ChatInputAreaProps extends React.HTMLAttributes<HTMLDivElement> {
    onSendMessage?: () => void;
    inputText?: string;
    setInputText?: (text: string) => void;
    inputAudio?: Blob;
    setInputAudio?: (blob?: Blob) => void;
    error?: string;
    disabled?: boolean;
}

const ChatInputArea: React.FC<ChatInputAreaProps> = ({
    onSendMessage,
    inputText,
    setInputText,
    inputAudio,
    setInputAudio,
    error,
    disabled = false }) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
    const { startRecording, stopRecording, recordingStatus, audio, streamRef, clearAudio } = useAudioRecorder();

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
            onSendMessage?.();
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
        if (audio && setInputAudio) {
            setInputAudio(audio);
        }
    }, [audio, setInputAudio]);

    const handleOnLongPressStart = () => {
        if (audio) {
            setInputAudio?.(undefined);
            clearAudio();
        }
        startRecording();
    }

    const handleOnLongPressEnd = () => {
        stopRecording();
    }

    return (
        <div className={styles["chat-input-area"]} >
            <div className={clsx(styles["input-container"], recordingStatus === "recording" && styles["recording"])} ref={containerRef}>
                {error && <div className={styles["error-message"]}>{error}</div>}
                {!error && (recordingStatus === "inactive" && !audio) &&
                    <input
                        type="text"
                        placeholder="Message..."
                        value={inputText}
                        onChange={handleOnChange}
                        onKeyDown={handleKeyDown}
                        disabled={disabled}
                    />}
                {audio && (
                    <AudioWaveform audioBlob={audio}
                        width={dimensions.width}
                        height={dimensions.height} />
                )}
                {(recordingStatus === "recording" && streamRef.current) && (
                    <AudioVisualizer
                        mediaStream={streamRef.current}
                        speed={1}
                        isRecording={recordingStatus === "recording"}
                        width={dimensions.width}
                        height={dimensions.height}
                    />
                )}
            </div>

            <div className={styles["buttons"]}>
                <LongPressButton
                    onShortPress={handleOnShortPress}
                    onDrag={handleOnLongPressEnd}
                    onLongPressStart={handleOnLongPressStart}
                    onLongPressEnd={handleOnLongPressEnd}
                    leftIcon={inputAudio ? <CloseSquareIcon /> : <MicrophoneIcon />}
                    className={styles["voice-btn"]}
                    color='yellow'
                    disabled={disabled} />
                <IconButton leftIcon={<SendIcon />} className={styles["send-btn"]} onClick={handleOnSendMessage} disabled={disabled} />
            </div>
        </div>
    );
};

export default ChatInputArea;