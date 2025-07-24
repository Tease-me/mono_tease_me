import { useState, useRef, useCallback } from "react";
import { useMicrophonePermission } from "./useMicrophonePermission";

export type RecordingStatus = "inactive" | "recording";

export interface UseAudioRecorderReturn {
    recordingStatus: RecordingStatus;
    audio: Blob | null;
    startRecording: () => Promise<void>;
    stopRecording: () => void;
    clearAudio: () => void;
    permissionState: ReturnType<typeof useMicrophonePermission>["permissionState"];
    streamRef: ReturnType<typeof useMicrophonePermission>["streamRef"];
}

export const useAudioRecorder = (mimeType: string = "audio/webm"): UseAudioRecorderReturn => {
    const { permissionState, requestMicrophonePermission, releaseMicrophonePermission, streamRef } =
        useMicrophonePermission();

    const [recordingStatus, setRecordingStatus] = useState<RecordingStatus>("inactive");
    const [audio, setAudio] = useState<Blob | null>(null);
    const [audioChunks, setAudioChunks] = useState<Blob[]>([]);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);

    const clearAudio = useCallback(() => {
        setAudio(null);
        setAudioChunks([]);
        setRecordingStatus("inactive");
        releaseMicrophonePermission();
    }, [releaseMicrophonePermission]);

    const startRecording = useCallback(async () => {
        if (!streamRef || permissionState !== "granted") {
            await requestMicrophonePermission();
            return;
        }

        setRecordingStatus("recording");

        streamRef.current = await navigator.mediaDevices.getUserMedia({ audio: true });
        const media = new MediaRecorder(streamRef.current, { mimeType });
        mediaRecorderRef.current = media;

        const localChunks: Blob[] = [];
        media.ondataavailable = (event) => {
            if (event.data && event.data.size > 0) localChunks.push(event.data);
        };

        media.start();
        setAudioChunks(localChunks);
    }, [permissionState, requestMicrophonePermission, mimeType, streamRef]);

    const stopRecording = useCallback(() => {
        setRecordingStatus("inactive");
        if (!mediaRecorderRef.current) return;

        mediaRecorderRef.current.stop();
        mediaRecorderRef.current.onstop = () => {
            const audioBlob = new Blob(audioChunks, { type: mimeType });
            setAudio(audioBlob);
            setAudioChunks([]);
            releaseMicrophonePermission();
        };
    }, [audioChunks, mimeType, releaseMicrophonePermission]);

    return { recordingStatus, audio, startRecording, stopRecording, clearAudio, permissionState, streamRef };
};