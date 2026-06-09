import { useState, useRef, useCallback } from "react";
import { useMicrophonePermission } from "./useMicrophonePermission";
import { showErrorModal } from "@/utils/errorModal";

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
    const audioChunksRef = useRef<Blob[]>([]);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);

    const clearAudio = useCallback(() => {
        setAudio(null);
        audioChunksRef.current = [];
        setRecordingStatus("inactive");
        releaseMicrophonePermission();
    }, [releaseMicrophonePermission]);

    const startRecording = useCallback(async () => {
        // Ask for permission and continue in the same tap instead of requiring a second press
        if (!streamRef || permissionState !== "granted") {
            const granted = await requestMicrophonePermission();
            if (!granted) {
                showErrorModal({
                    title: "Microphone Permission Denied",
                    message:
                        "Microphone access is required to start recording. Please enable microphone permissions in your browser settings and try again.",
                });
                return;
            };
        }

        // clear previous buffer
        audioChunksRef.current = [];

        setRecordingStatus("recording");

        streamRef.current = await navigator.mediaDevices.getUserMedia({ audio: true });
        const media = new MediaRecorder(streamRef.current, { mimeType });
        mediaRecorderRef.current = media;

        media.ondataavailable = (event) => {
            if (event.data && event.data.size > 0) audioChunksRef.current.push(event.data);
        };

        media.start();
    }, [permissionState, requestMicrophonePermission, mimeType, streamRef]);

    const stopRecording = useCallback(() => {
        setRecordingStatus("inactive");
        if (!mediaRecorderRef.current) return;

        mediaRecorderRef.current.stop();
        mediaRecorderRef.current.onstop = () => {
            const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
            setAudio(audioBlob);
            audioChunksRef.current = [];
            releaseMicrophonePermission();
        };
    }, [mimeType, releaseMicrophonePermission]);

    return { recordingStatus, audio, startRecording, stopRecording, clearAudio, permissionState, streamRef };
};
