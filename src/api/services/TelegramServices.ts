import { AxiosInstance } from "axios";
import { Endpoints } from "../urls";

// ── Types ──────────────────────────────────────────────

export type AvailableNumber = {
  phone_number: string;
  friendly_name: string;
  locality: string | null;
  region: string | null;
  iso_country: string;
  capabilities: Record<string, boolean> | null;
};

export type NumberSearchResponse = {
  numbers: AvailableNumber[];
  count: number;
};

export type NumberSearchParams = {
  country_code?: string;
  number_type?: string;
  area_code?: string;
  contains?: string;
  limit?: number;
};

export type ProvisionRequest = {
  phone_number: string;
  influencer_id?: string | null;
  first_name?: string;
  last_name?: string;
};

export type ProvisionedNumber = {
  id: number;
  phone_number: string;
  twilio_sid: string;
  country_code: string;
  influencer_id: string | null;
  telegram_session_status: string;
  telegram_user_id: number | null;
  telegram_username: string | null;
  telegram_first_name: string | null;
  telegram_last_name: string | null;
  is_active: boolean;
  error_message: string | null;
  created_at: string;
  updated_at: string;
};

export type ProvisionedNumberList = {
  numbers: ProvisionedNumber[];
  count: number;
};

export type ProvisionStatus = {
  ok: boolean;
  phone_number: string;
  status: string;
  message: string;
};

// ── Service ────────────────────────────────────────────

export function TelegramServices(api: AxiosInstance) {
  const urls = Endpoints.admin.telegram;

  return {
    async searchNumbers(params: NumberSearchParams): Promise<NumberSearchResponse> {
      const { data } = await api.post(urls.searchNumbers, params);
      return data;
    },

    async provision(req: ProvisionRequest): Promise<ProvisionStatus> {
      const { data } = await api.post(urls.provision, req);
      return data;
    },

    async listProvisioned(): Promise<ProvisionedNumberList> {
      const { data } = await api.get(urls.listProvisioned);
      return data;
    },

    async getProvisioned(id: number): Promise<ProvisionedNumber> {
      const { data } = await api.get(urls.provisionedDetail(id));
      return data;
    },

    async retryProvision(id: number): Promise<ProvisionStatus> {
      const { data } = await api.post(urls.retryProvision(id));
      return data;
    },

    async releaseNumber(id: number): Promise<void> {
      await api.delete(urls.releaseNumber(id));
    },
  };
}
