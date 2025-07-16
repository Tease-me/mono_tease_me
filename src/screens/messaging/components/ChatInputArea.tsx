import React, { useEffect, useRef, useState, useLayoutEffect } from 'react';

import CircularIconButton from '@/components/buttons/CircularIconButton';
import MicrophoneIcon from "@/assets/Microphone.svg?react";
import SendIcon from "@/assets/Send.svg?react";

import styles from "./ChatInputArea.module.css"
import AudioVisualizer from './AudioVisualizer';
import AudioWaveform from './AudioWaveform';

interface ChatInputAreaProps extends React.HTMLAttributes<HTMLDivElement> {
    onSendMessage?: () => void;
    inputText?: string;
    setInputText?: (text: string) => void;
}

const ChatInputArea: React.FC<ChatInputAreaProps> = ({ onSendMessage, inputText, setInputText }) => {
    const [isRecording, setIsRecording] = useState(false);
    const [audio, setAudio] = useState<Blob>();
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

    const startRecording = async () => {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        setStream(stream);
        const mediaRecorder = new MediaRecorder(stream);
        mediaRecorderRef.current = mediaRecorder;
        chunksRef.current = [];

        mediaRecorder.addEventListener('dataavailable', (e: BlobEvent) => {
            if (e.data.size > 0) chunksRef.current.push(e.data);
        });

        mediaRecorder.addEventListener('stop', () => {
            const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
            setAudio(blob);
        });

        mediaRecorder.start();
        setIsRecording(true);
    };

    const stopRecording = () => {
        mediaRecorderRef.current?.stop();
        setIsRecording(false);
        stream?.getTracks().forEach(track => track.stop());
    };

    const clearAudio = () => {
        setAudio(undefined);
    }

    return (
        <div className={styles["chat-input-area"]}>
            <div className={styles["input-container"]} ref={containerRef}>
                <input
                    type="text"
                    placeholder="Message..."
                    value={inputText}
                    onChange={(e) => setInputText && setInputText(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && onSendMessage && onSendMessage()}
                />
                {audio && (
                    <>
                        <AudioWaveform audioBlob={audio}
                            width={dimensions.width}
                            height={dimensions.height} />
                        <span onClick={clearAudio}>X</span>
                    </>
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
                    icon={<MicrophoneIcon />}
                    className={styles["voice-btn"]}
                    size="small"
                    variant="secondary"
                    style={{ touchAction: 'none' }}
                    onPointerDown={startRecording}
                    onPointerUp={stopRecording}
                    onPointerLeave={() => isRecording && stopRecording()}
                    onPointerCancel={() => isRecording && stopRecording()}
                    onPointerOut={() => isRecording && stopRecording()}
                />
                <CircularIconButton icon={<SendIcon />} className={styles["send-btn"]} onClick={onSendMessage} size="small" />
            </div>
        </div>
    );
};

export default ChatInputArea;