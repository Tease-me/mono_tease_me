let microphoneStream: MediaStream | null = null;

export async function requestMicrophonePermission(): Promise<boolean> {
    try {
        microphoneStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        return true;
    } catch {
        console.error("Microphone permission denied");
        return false;
    }
}

export function releaseMicrophonePermission(): void {
    if (microphoneStream) {
        microphoneStream.getTracks().forEach(track => track.stop());
        microphoneStream = null;
    }
}