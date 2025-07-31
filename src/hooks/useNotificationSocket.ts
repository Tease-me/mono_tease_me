import { WsEndpoints } from "@/api/urls";
import { useEffect } from "react";

export default function useNotificationSocket(email: string, onEmailVerified: () => void) {
    useEffect(() => {
        if (!email) return;
        const ws = new WebSocket(`${WsEndpoints.NOTIFICATION}?email=${email}`);
        ws.onmessage = (event) => {
            const data = JSON.parse(event.data);
            if (data.type === "email_verified") {
                onEmailVerified?.();
                ws.close()
            }
        };
        return () => ws.close();
    }, [email, onEmailVerified]);
}