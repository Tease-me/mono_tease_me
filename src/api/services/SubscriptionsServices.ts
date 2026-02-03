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
    captureSubscription: async (subscriptionId: string, orderId: string, amountCents: number): Promise<any> => {
        const response = await apiClient.post(
            Endpoints.subscriptions.capture,
            {},
            { params: { subscription_id: subscriptionId, order_id: orderId, amount_cents: amountCents } }
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
    },
    purchaseAddon: async (addonId: number, influencerId: string) => {
        const payload = {
            addon_plan_id: addonId,
            influencer_id: influencerId
        }
        const response = await apiClient.post(Endpoints.subscriptions.addons_purchase, payload);
        return response.data;
    }
})
