import { Endpoints } from "../urls";
import { AxiosInstance } from "axios";

export const SubscriptionsServices = (apiClient: AxiosInstance) => ({
    startSubscription: async (influencerId: string): Promise<any> => {
        const response = await apiClient.post(
            Endpoints.subscriptions.start,
            { influencer_id: influencerId, price_cents: 1000 }
        );
        return response.data;
    },
    captureSubscription: async (orderId: string, subscriptionId: string, amountCents: number): Promise<any> => {
        const response = await apiClient.post(
            Endpoints.subscriptions.capture,
            { order_id: orderId, subscription_id: subscriptionId, amount_cents: amountCents }
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
    activateMySubscriptionForInfluencer: async (influencerId: string): Promise<any> => {
        const response = await apiClient.get(
            Endpoints.subscriptions.influencerActivate(influencerId),
        );
        return response.data;
    },
})