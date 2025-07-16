import React, { useEffect, useRef, useState } from 'react';

import CircularIconButton from '@/components/buttons/CircularIconButton';
import CallIcon from "@/assets/Call.svg?react";
import MicrophoneIcon from "@/assets/Microphone.svg?react";
import SendIcon from "@/assets/Send.svg?react";

import styles from "./ChatInputArea.module.css"
import AudioBlobVisualizer from './AudioVisualizer';
import AudioSpectrogram from './AudioSpectrogram';

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

    const startRecording = async () => {
        // 1. Ask for mic access
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        // 2. Create MediaRecorder
        setStream(stream);
        const mediaRecorder = new MediaRecorder(stream);
        mediaRecorderRef.current = mediaRecorder;
        chunksRef.current = [];

        // 3. Gather data
        mediaRecorder.addEventListener('dataavailable', (e: BlobEvent) => {
            if (e.data.size > 0) chunksRef.current.push(e.data);
        });

        // 4. When stopped, make blob → URL
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
    };
    console.log("Audio", audio)
    return (
        <div className={styles["chat-input-area"]}>
            <div className={styles["input-container"]}>
                <input
                    type="text"
                    placeholder="Message..."
                    value={inputText}
                    onChange={(e) => setInputText && setInputText(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && onSendMessage && onSendMessage()}
                />
                {audio && (
                    <AudioSpectrogram audioBlob={audio} />
                )}
                {stream && <AudioBlobVisualizer mediaStream={stream} />}
            </div>

            <div className={styles["buttons"]}>
                {isRecording ?
                    <CircularIconButton icon={<MicrophoneIcon />} className={styles["voice-btn"]} onClick={stopRecording} size="small" variant="secondary" />
                    :
                    <CircularIconButton icon={<MicrophoneIcon />} className={styles["call-btn"]} onClick={startRecording} size="small" />
                }
                <CircularIconButton icon={<SendIcon />} className={styles["send-btn"]} onClick={onSendMessage} size="small" />
            </div>
        </div>
    );
};

export default ChatInputArea;