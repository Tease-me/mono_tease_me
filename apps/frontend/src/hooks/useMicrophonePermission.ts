import { useCallback, useEffect, useRef, useState } from "react";

type PermissionState = "prompt" | "granted" | "denied" | "not-found";

export function useMicrophonePermission() {
    const [permissionState, setPermissionState] = useState<PermissionState>("prompt");
    const streamRef = useRef<MediaStream | null>(null);

    const release = useCallback(() => {
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(t => t.stop());
            streamRef.current = null;
        }
    }, []);

    const request = useCallback(async () => {
        if (!("MediaRecorder" in window) || !navigator.mediaDevices?.getUserMedia) {
            setPermissionState("not-found");
            throw new Error("MediaRecorder API not supported");
        }

        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            // immediately stop tracks; we just needed the grant
            stream.getTracks().forEach(t => t.stop());
            setPermissionState("granted");
            return true;
        } catch (err: any) {
            if (err?.name === "NotAllowedError") setPermissionState("denied");
            else if (err?.name === "NotFoundError") setPermissionState("not-found");
            else setPermissionState("denied");
            return false;
        }
    }, []);

    // optional: query the Permissions API if available
    useEffect(() => {
        let cancelled = false;
        if ("permissions" in navigator && (navigator as any).permissions.query) {
            (navigator as any).permissions
                .query({ name: "microphone" as PermissionName })
                .then((status: PermissionStatus) => {
                    if (cancelled) return;
                    setPermissionState(status.state as PermissionState);
                    status.onchange = () => setPermissionState(status.state as PermissionState);
                })
                .catch(() => {/* ignore – fallback to manual request */ });
        }
        return () => { cancelled = true; };
    }, []);

    return {
        permissionState,
        requestMicrophonePermission: request,
        releaseMicrophonePermission: release,
        streamRef // expose if you want to reuse a single stream later
    };
}