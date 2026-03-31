import { useEffect, useRef, useCallback } from "react";
import { WS_BASE_URL, Endpoints } from "@/api/urls";
import logger from "@/utils/logger";

export type NotificationEvent =
  | { type: "email_verified" }
  | { type: "low_balance"; balance_cents: number; msg: string }
  | {
      type: "call_billed";
      balance_cents: number;
      cost_cents: number;
      duration_secs: number;
      conversation_id: string;
    };

type NotificationHandler = (event: NotificationEvent) => void;

const RECONNECT_BASE_MS = 1_000;
const RECONNECT_MAX_MS = 30_000;

/**
 * Connects to `/ws/notifications` for the authenticated user's session.
 * Automatically reconnects with exponential backoff on unexpected close.
 *
 * @param email - The authenticated user's email. Pass undefined/null to disconnect.
 * @param onEvent - Callback fired for every incoming notification event.
 */
export function useNotificationSocket(
  email: string | undefined | null,
  onEvent: NotificationHandler,
) {
  const socketRef = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const attemptRef = useRef(0);
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;

  const clearReconnect = useCallback(() => {
    if (reconnectTimer.current !== null) {
      clearTimeout(reconnectTimer.current);
      reconnectTimer.current = null;
    }
  }, []);

  const connect = useCallback(
    (userEmail: string) => {
      clearReconnect();

      const url = `${WS_BASE_URL}${Endpoints.ws.notifications}?email=${encodeURIComponent(userEmail)}`;
      const ws = new WebSocket(url);
      socketRef.current = ws;

      ws.onopen = () => {
        attemptRef.current = 0;
        logger.info("[NotificationSocket] connected");
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data) as NotificationEvent;
          onEventRef.current(data);
        } catch (err) {
          logger.error("[NotificationSocket] failed to parse message", err);
        }
      };

      ws.onclose = (event) => {
        socketRef.current = null;

        // Normal close (logout, unmount) — don't reconnect
        if (event.code === 1000 || event.code === 4001) {
          logger.info("[NotificationSocket] closed cleanly");
          return;
        }

        // Unexpected close — reconnect with exponential backoff
        const delay = Math.min(
          RECONNECT_BASE_MS * 2 ** attemptRef.current,
          RECONNECT_MAX_MS,
        );
        attemptRef.current += 1;
        logger.warn(
          `[NotificationSocket] unexpected close (${event.code}), reconnecting in ${delay}ms`,
        );
        reconnectTimer.current = setTimeout(() => connect(userEmail), delay);
      };

      ws.onerror = () => {
        logger.error("[NotificationSocket] connection error");
      };
    },
    [clearReconnect],
  );

  useEffect(() => {
    if (!email) {
      // No email → tear down any existing connection
      clearReconnect();
      if (socketRef.current) {
        socketRef.current.close(1000, "logout");
        socketRef.current = null;
      }
      return;
    }

    connect(email);

    return () => {
      clearReconnect();
      if (socketRef.current) {
        socketRef.current.close(1000, "unmount");
        socketRef.current = null;
      }
      attemptRef.current = 0;
    };
  }, [email, connect, clearReconnect]);
}
