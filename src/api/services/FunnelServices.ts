import { AxiosInstance } from "axios";
import { Endpoints } from "../urls";

/**
 * Fire-and-forget funnel event reporter.
 *
 * Used to report Telegram-funnel-originated events from the frontend
 * (link_clicked, registration_started) back to the backend for analytics.
 * Failures are silently swallowed — tracking must never block user flows.
 */
export const FunnelServices = (apiClient: AxiosInstance) => ({
  reportEvent: async (
    event_type: "link_clicked" | "registration_started",
    invite_code: string,
  ): Promise<void> => {
    try {
      await apiClient.post(Endpoints.funnel.event, {
        event_type,
        invite_code,
      });
    } catch {
      // fire-and-forget — never block user flow
    }
  },
});
