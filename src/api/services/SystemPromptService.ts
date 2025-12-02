import { AxiosInstance } from "axios";
import { Endpoints } from "../urls";

export type SystemPromptListItem = {
    key: string;
    description?: string;
    updated_at?: string;
};

export type SystemPromptDetail = {
    key: string;
    prompt: string;
    description?: string;
    updated_at?: string;
};

export type SystemPromptUpdateRequest = {
    prompt: string;
    description?: string;
};

export const SystemPromptService = (apiClient: AxiosInstance) => ({
    list: async (): Promise<SystemPromptListItem[]> => {
        const response = await apiClient.get<SystemPromptListItem[]>(Endpoints.admin.systemPrompts.list);
        return response.data;
    },
    get: async (key: string): Promise<SystemPromptDetail> => {
        const response = await apiClient.get<SystemPromptDetail>(Endpoints.admin.systemPrompts.byKey(key));
        return response.data;
    },
    upsert: async (key: string, payload: SystemPromptUpdateRequest): Promise<SystemPromptListItem> => {
        const response = await apiClient.post<SystemPromptListItem>(Endpoints.admin.systemPrompts.byKey(key), payload);
        return response.data;
    },
});
