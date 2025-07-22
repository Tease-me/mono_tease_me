import React, { useEffect, useRef, useState, useLayoutEffect } from 'react';

import CircularIconButton from '@/ui/components/buttons/CircularIconButton';
import MicrophoneIcon from "@/assets/Microphone.svg?react";
import SendIcon from "@/assets/svg/Send.svg?react";
import CallIcon from "@/assets/Call.svg?react"
import CloseSquareIcon from "@/assets/CloseSquare.svg?react";

// --- Cross-browser helpers -------------------------------------------------
const pickSupportedMimeType = (): string | undefined => {
    if (typeof window === 'undefined' || !(window as any).MediaRecorder) return undefined;
    const candidates = [
        'audio/webm'
    ];
    return candidates.find(t => (window as any).MediaRecorder.isTypeSupported(t));
};

const getAudioStream = async (): Promise<MediaStream> => {
    if (navigator.mediaDevices?.getUserMedia) {
        return navigator.mediaDevices.getUserMedia({ audio: true });
    }
    const legacy = (navigator as any).webkitGetUserMedia || (navigator as any).mozGetUserMedia;
    return new Promise<MediaStream>((resolve, reject) => {
        if (!legacy) {
            reject(new Error('getUserMedia is not supported in this browser'));
            return;
        }
        legacy.call(navigator, { audio: true }, resolve, reject);
    });
};

const showWebmUnsupportedError = () => {
    alert('Your browser cannot record audio/webm. Please try Chrome, Edge or Firefox.');
};

import styles from "./ChatInputArea.module.css"
import AudioVisualizer from './AudioVisualizer';
import AudioWaveform from './AudioWaveform';

interface ChatInputAreaProps extends React.HTMLAttributes<HTMLDivElement> {
    onSendMessage?: () => void;
    inputText?: string;
    setInputText?: (text: string) => void;
    inputAudio?: Blob;
    setInputAudio?: (blob?: Blob) => void;
}

const ChatInputArea: React.FC<ChatInputAreaProps> = ({
    onSendMessage,
    inputText,
    setInputText,
    inputAudio,
    setInputAudio }) => {
    const [isRecording, setIsRecording] = useState(false);
    const mediaRecorderRef = useRef<MediaRecorder>(null);
    const chunksRef = useRef<Blob[]>([]);
    const [stream, setStream] = useState<MediaStream>();

    const containerRef = useRef<HTMLDivElement>(null);
    const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

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

    const handlePressStart = (e: React.SyntheticEvent) => {
        e.preventDefault();
        startRecording();
    };

    const handlePressEnd = (e: React.SyntheticEvent) => {
        e.preventDefault();
        stopRecording();
    };

    const startRecording = async () => {
        if (inputAudio) {
            clearAudio();
            return;
        }
        setInputAudio?.(undefined);

        // Ensure browser can create audio/webm
        const mimeType = pickSupportedMimeType();
        if (!mimeType) {
            showWebmUnsupportedError();
            return;
        }

        try {
            const s = await getAudioStream();
            setStream(s);

            const mediaRecorder = new MediaRecorder(s, { mimeType });
            mediaRecorderRef.current = mediaRecorder;
            chunksRef.current = [];

            mediaRecorder.addEventListener('dataavailable', (e: BlobEvent) => {
                if (!e.data || e.data.size === 0) return;
                chunksRef.current.push(e.data);
            });

            mediaRecorder.addEventListener('stop', () => {
                const blob = new Blob(chunksRef.current, { type: mimeType });
                setInputAudio?.(blob);
                chunksRef.current = [];
            });

            mediaRecorder.start();
            setIsRecording(true);
        } catch (err) {
            console.error('Microphone access failed:', err);
        }
    };

    const stopRecording = () => {
        try {
            mediaRecorderRef.current?.stop();
        } catch (e) {
            console.warn('MediaRecorder.stop failed', e);
        }
        setIsRecording(false);
        stream?.getTracks().forEach(track => track.stop());
    };

    const clearAudio = () => {
        setInputAudio?.(undefined);
    }

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

    return (
        <div className={styles["chat-input-area"]}>
            <div className={styles["input-container"]} ref={containerRef}>
                {(!isRecording && !inputAudio) &&
                    <input
                        type="text"
                        placeholder="Message..."
                        value={inputText}
                        onChange={handleOnChange}
                        onKeyDown={handleKeyDown}
                    />}
                {inputAudio && (
                    <AudioWaveform audioBlob={inputAudio}
                        width={dimensions.width}
                        height={dimensions.height} />
                )}
                {(isRecording && stream) && (
                    <AudioVisualizer
                        mediaStream={stream}
                        speed={1}
                        isRecording={isRecording}
                        setIsRecording={setIsRecording}
                        width={dimensions.width}
                        height={dimensions.height}
                    />
                )}
            </div>

            <div className={styles["buttons"]}>
                <CircularIconButton
                    icon={inputAudio ? <CloseSquareIcon /> : <MicrophoneIcon />}
                    className={styles["voice-btn"]}
                    size="xsmall"
                    variant="secondary"
                    onPointerDown={handlePressStart}
                    onPointerUp={handlePressEnd}
                    onMouseDown={handlePressStart}
                    onMouseUp={handlePressEnd}
                    onTouchStart={handlePressStart}
                    onTouchEnd={handlePressEnd}
                    onPointerLeave={(e) => { e.preventDefault(); isRecording && stopRecording(); }}
                    onPointerCancel={(e) => { e.preventDefault(); isRecording && stopRecording(); }}
                    onContextMenu={(e) => e.preventDefault()}
                />
                <CircularIconButton icon={<SendIcon />} className={styles["send-btn"]} onClick={onSendMessage} size="xsmall" />
            </div>
        </div>
    );
};

export default ChatInputArea;