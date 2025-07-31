import { useEffect } from "react";
export default function useNotificationSocket(token: string, onEmailVerified: () => void) {
    useEffect(() => {
        if (!token) return;
        const ws = new WebSocket(`ws://localhost:8000/ws/notifications?token=${token}`);
        ws.onmessage = (event) => {
            const data = JSON.parse(event.data);
            if (data.type === "email_verified") {
                onEmailVerified?.();
            }
        };
        return () => ws.close();
    }, [token, onEmailVerified]);
}