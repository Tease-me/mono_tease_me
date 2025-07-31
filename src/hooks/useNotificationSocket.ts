import { WsEndpoints } from "@/api/urls";
import { useEffect } from "react";

export default function useNotificationSocket(token: string, onEmailVerified: () => void) {
    useEffect(() => {
        if (!token) return;
        const ws = new WebSocket(`${WsEndpoints.NOTIFICATION}?token=${token}`);
        ws.onmessage = (event) => {
            const data = JSON.parse(event.data);
            if (data.type === "email_verified") {
                onEmailVerified?.();
            }
        };
        return () => ws.close();
    }, [token, onEmailVerified]);
}