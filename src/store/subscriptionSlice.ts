import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import { SubscriptionsServices } from "@/api/services/SubscriptionsServices";
import { apiClient } from "@/api/apis";
import logger from "@/utils/logger";
import type { AppDispatch, RootState } from "./store";

const subscriptionSvc = SubscriptionsServices(apiClient);

interface SubscriptionState {
  isSubscribing: boolean;
  subscribeError?: string;
  statusByInfluencerId: Record<string, NormalizedSubscriptionStatus | undefined>;
  loadingByInfluencerId: Record<string, boolean | undefined>;
  errorByInfluencerId: Record<string, string | undefined>;
}

export type SubscribeResult = {
  success: boolean;
  message: string;
};

type StartSubscriptionPayload = {
  influencerId: string;
  planId: number;
  amountCents: number;
  orderId?: string;
};

type FetchSubscriptionStatusPayload = {
  influencerId: string;
  force?: boolean;
};

type SetAdultModePayload = {
  influencerId: string;
  checked: boolean;
};

type SubscriptionApiResponse = {
  has_subscription?: boolean;
  status?: string;
  is_18_selected?: boolean;
};

export type NormalizedSubscriptionStatus = {
  hasSubscription: boolean;
  isSubscribed: boolean;
  isAdult: boolean;
  status?: string;
};

type SetAdultModeResult = {
  success: boolean;
  idVerified?: boolean;
  message?: string;
};

const subscriptionStatusCache = new Map<string, SubscriptionApiResponse | undefined>();
const subscriptionStatusInFlight = new Map<
  string,
  Promise<SubscriptionApiResponse | undefined>
>();

const normalizeStatus = (
  subscription: SubscriptionApiResponse | undefined
): NormalizedSubscriptionStatus => {
  const hasSubscription = subscription?.has_subscription === true;
  const isSubscribed = hasSubscription && subscription?.status === "active";
  const isAdult = isSubscribed && subscription?.is_18_selected === true;
  return {
    hasSubscription,
    isSubscribed,
    isAdult,
    status: subscription?.status,
  };
};

const initialState: SubscriptionState = {
  isSubscribing: false,
  subscribeError: undefined,
  statusByInfluencerId: {},
  loadingByInfluencerId: {},
  errorByInfluencerId: {},
};

const subscriptionSlice = createSlice({
  name: "subscription",
  initialState,
  reducers: {
    setIsSubscribing(state, action: PayloadAction<boolean>) {
      state.isSubscribing = action.payload;
    },
    setSubscribeError(state, action: PayloadAction<string | undefined>) {
      state.subscribeError = action.payload;
    },
    setStatusLoading(
      state,
      action: PayloadAction<{ influencerId: string; loading: boolean }>
    ) {
      state.loadingByInfluencerId[action.payload.influencerId] =
        action.payload.loading;
    },
    setStatusError(
      state,
      action: PayloadAction<{ influencerId: string; error?: string }>
    ) {
      state.errorByInfluencerId[action.payload.influencerId] = action.payload.error;
    },
    setSubscriptionStatus(
      state,
      action: PayloadAction<{
        influencerId: string;
        status: NormalizedSubscriptionStatus;
      }>
    ) {
      state.statusByInfluencerId[action.payload.influencerId] = action.payload.status;
    },
  },
});

export const subscriptionActions = subscriptionSlice.actions;

export const startInfluencerSubscription =
  ({ influencerId, planId, amountCents, orderId }: StartSubscriptionPayload) =>
  async (
    dispatch: AppDispatch,
    getState: () => RootState
  ): Promise<SubscribeResult> => {
    if (getState().subscription.isSubscribing) {
      return { success: false, message: "Subscription already in progress." };
    }

    dispatch(subscriptionActions.setIsSubscribing(true));
    dispatch(subscriptionActions.setSubscribeError(undefined));

    try {
      const startRes = await subscriptionSvc.startSubscription(influencerId, planId);
      const resolvedOrderId =
        orderId ??
        ((typeof crypto !== "undefined" && "randomUUID" in crypto)
          ? crypto.randomUUID()
          : `order_${Date.now()}_${Math.random().toString(16).slice(2)}`);
      const subId = startRes?.subscription_id ?? startRes?.subscriptionId;
      if (!subId) {
        throw new Error("Missing subscription ID");
      }

      await subscriptionSvc.captureSubscription(String(subId), resolvedOrderId, amountCents);
      await subscriptionSvc.activateMySubscriptionForInfluencer(influencerId, true);
      return { success: true, message: "Subscription successful!" };
    } catch (err: any) {
      logger.error("Subscription error:", err);
      const message =
        err?.response?.data?.detail?.message ??
        err?.message ??
        "Error subscribing. Please try again.";
      dispatch(subscriptionActions.setSubscribeError(message));
      return { success: false, message };
    } finally {
      dispatch(subscriptionActions.setIsSubscribing(false));
    }
  };

export const fetchSubscriptionStatus =
  ({ influencerId, force = false }: FetchSubscriptionStatusPayload) =>
  async (dispatch: AppDispatch): Promise<NormalizedSubscriptionStatus | undefined> => {
    try {
      dispatch(
        subscriptionActions.setStatusLoading({ influencerId, loading: true })
      );
      dispatch(subscriptionActions.setStatusError({ influencerId, error: undefined }));

      let subscription: SubscriptionApiResponse | undefined;
      if (!force && subscriptionStatusCache.has(influencerId)) {
        subscription = subscriptionStatusCache.get(influencerId);
      } else if (!force && subscriptionStatusInFlight.has(influencerId)) {
        subscription = await subscriptionStatusInFlight.get(influencerId);
      } else {
        const request = subscriptionSvc
          .getMySubscriptionForInfluencer(influencerId)
          .then((response) => {
            subscriptionStatusCache.set(influencerId, response);
            return response as SubscriptionApiResponse | undefined;
          })
          .finally(() => {
            subscriptionStatusInFlight.delete(influencerId);
          });

        subscriptionStatusInFlight.set(influencerId, request);
        subscription = await request;
      }

      const normalized = normalizeStatus(subscription);
      dispatch(
        subscriptionActions.setSubscriptionStatus({
          influencerId,
          status: normalized,
        })
      );
      return normalized;
    } catch (err: any) {
      const message =
        err?.response?.data?.detail?.message ??
        err?.message ??
        "Failed to load subscription status.";
      dispatch(subscriptionActions.setStatusError({ influencerId, error: message }));
      return undefined;
    } finally {
      dispatch(
        subscriptionActions.setStatusLoading({ influencerId, loading: false })
      );
    }
  };

export const setAdultModeSelection =
  ({ influencerId, checked }: SetAdultModePayload) =>
  async (dispatch: AppDispatch): Promise<SetAdultModeResult> => {
    try {
      await subscriptionSvc.activateMySubscriptionForInfluencer(influencerId, checked);
      subscriptionStatusCache.delete(influencerId);
      await dispatch(fetchSubscriptionStatus({ influencerId, force: true }));
      return { success: true };
    } catch (err: any) {
      logger.error("Error updating adult mode selection:", err);
      const idVerified =
        err?.response?.data?.detail?.verification_status?.is_identity_verified;
      const message =
        err?.response?.data?.detail?.message ??
        err?.message ??
        "Failed to update adult mode.";
      dispatch(subscriptionActions.setStatusError({ influencerId, error: message }));
      return { success: false, idVerified, message };
    }
  };

export default subscriptionSlice.reducer;
