import { Endpoints } from "../urls";
import { AxiosInstance } from "axios";
import type { SubscriptionPlansResponse } from "@/data/models/SubscriptionPlans";

export const SubscriptionsServices = (apiClient: AxiosInstance) => ({
    startSubscription: async (influencerId: string, planId: number): Promise<any> => {
        const response = await apiClient.post(
            Endpoints.subscriptions.start,
            null,
            {
                params: { influencer_id: influencerId, plan_id: planId }
            }
        );
        return response.data;
    },
    captureSubscription: async (orderId: string, subscriptionId: string, amountCents: number): Promise<any> => {
        const response = await apiClient.post(
            Endpoints.subscriptions.capture,
            {},
            { params: { order_id: orderId, subscription_id: subscriptionId, amount_cents: amountCents } }
        );
        return response.data;
    },
    getMySubscriptions: async (): Promise<any> => {
        const response = await apiClient.get(
            Endpoints.subscriptions.list,
        );
        return response.data;
    },
    getMySubscriptionForInfluencer: async (influencerId: string): Promise<any> => {
        const response = await apiClient.get(
            Endpoints.subscriptions.influencer(influencerId),
        );
        return response.data;
    },
    activateMySubscriptionForInfluencer: async (influencerId: string, is_18_selected: boolean): Promise<any> => {
        const response = await apiClient.post(
            Endpoints.subscriptions.influencerActivate(influencerId),
            {
                "is_18_selected": is_18_selected
            }
        );
        return response.data;
    },
    cancelSubscription: async (influencerId: string, reason?: string) => {
        const payload = {
            influencer_id: influencerId,
            reason: reason
        }
        const response = await apiClient.post(
            Endpoints.subscriptions.cancel, payload
        );
        return response.data;
    },
    getPlans: async (): Promise<SubscriptionPlansResponse> => {
        const response = await apiClient.get(Endpoints.subscriptions.plans);
        return response.data;
    }
})
