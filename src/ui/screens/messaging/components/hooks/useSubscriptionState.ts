import type { InfluencerDataModel } from "@/data/models/InfluencerDataModel";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import {
  fetchSubscriptionStatus,
  setAdultModeSelection,
  startInfluencerSubscription,
} from "@/store/subscriptionSlice";
import logger from "@/utils/logger";
import { useCallback, useEffect, useState } from "react";

interface UseSubscriptionStateProps {
  influencer?: InfluencerDataModel;
  openSubscribe?: boolean;
  blockIfCallActive: () => boolean;
}

export function useSubscriptionState({
  influencer,
  openSubscribe,
  blockIfCallActive,
}: UseSubscriptionStateProps) {
  const dispatch = useAppDispatch();
  const { isSubscribing } = useAppSelector((state) => state.subscription);
  const subscriptionStatus = useAppSelector((state) =>
    influencer
      ? state.subscription.statusByInfluencerId[influencer.id]
      : undefined,
  );
  const [adultMode, setAdultMode] = useState(false);
  const [adultModeSwitch, setAdultModeSwitch] = useState(false);
  const [hasSubscription, setHasSubscription] = useState(false);
  const [showSubscriptionPage, setShowSubscriptionPage] = useState(false);
  const [showTermsModal, setShowTermsModal] = useState(false);
  const [showErrorAlert, setShowErrorAlert] = useState<string | undefined>();

  useEffect(() => {
    if (!influencer?.id) return;
    void dispatch(fetchSubscriptionStatus({ influencerId: influencer.id }));
  }, [dispatch, influencer?.id]);

  useEffect(() => {
    if (!subscriptionStatus) return;
    setHasSubscription(subscriptionStatus.hasSubscription);
    setAdultModeSwitch(subscriptionStatus.isAdult);
    setAdultMode(subscriptionStatus.isAdult);
  }, [subscriptionStatus]);

  useEffect(() => {
    if (openSubscribe) {
      setShowSubscriptionPage(true);
    }
  }, [openSubscribe]);

  const handleAdultModeChange = useCallback(
    async (checked: boolean) => {
      if (blockIfCallActive()) return;

      if (!influencer) {
        setAdultModeSwitch(false);
        return;
      }
      setShowErrorAlert(undefined);
      setAdultModeSwitch(checked);

      if (!checked) {
        setShowSubscriptionPage(false);
        setAdultMode(false);
        try {
          await dispatch(
            setAdultModeSelection({
              influencerId: influencer.id,
              checked: false,
            }),
          );
        } catch (err) {
          logger.error("Error deactivating adult mode:", err);
        }
        return;
      }

      try {
        const status = await dispatch(
          fetchSubscriptionStatus({ influencerId: influencer.id }),
        );
        if (status?.hasSubscription) {
          if (!status?.isAdult) {
            const updateResult = await dispatch(
              setAdultModeSelection({
                influencerId: influencer.id,
                checked: true,
              }),
            );
            if (!updateResult.success) {
              if (updateResult.idVerified === false) {
                setShowTermsModal(true);
                setAdultModeSwitch(false);
                return;
              }
              setShowErrorAlert(
                updateResult.message ||
                  "Failed to enable adult mode. Please try again.",
              );
              setAdultModeSwitch(false);
              return;
            }
          }
          setShowSubscriptionPage(false);
          setAdultMode(true);
          setAdultModeSwitch(true);
          return;
        }

        const activateResult = await dispatch(
          setAdultModeSelection({ influencerId: influencer.id, checked: true }),
        );
        if (!activateResult.success) {
          if (activateResult.idVerified === false) {
            setShowTermsModal(true);
            setAdultModeSwitch(false);
            return;
          }
          setAdultModeSwitch(false);
          setShowSubscriptionPage(false);
          setShowErrorAlert(
            activateResult.message ||
              "Failed to enable adult mode. Please try again.",
          );
          return;
        }
        setShowSubscriptionPage(true);
        setAdultMode(false);
      } catch (err: any) {
        const idVerified =
          err?.response?.data?.detail?.verification_status
            ?.is_identity_verified;
        if (idVerified === false) {
          setShowTermsModal(true);
          setAdultModeSwitch(false);
          return;
        }
        logger.error("Error enabling adult mode subscription:", err);
        setAdultModeSwitch(false);
        setShowSubscriptionPage(false);
        setShowErrorAlert(
          err?.response?.data?.detail?.message ||
            "Failed to enable adult mode. Please try again.",
        );
      }
    },
    [dispatch, influencer],
  );

  const handleSubscribePressed = useCallback(async () => {
    if (!influencer || isSubscribing) return;
    try {
      const result = await dispatch(
        startInfluencerSubscription({
          influencerId: influencer.id,
          planId: 1,
          amountCents: 10000,
        }),
      );
      if (!result.success) {
        window.alert(result.message);
        return;
      }
      await dispatch(
        fetchSubscriptionStatus({ influencerId: influencer.id, force: true }),
      );
      window.alert(result.message);
      setAdultMode(true);
      setAdultModeSwitch(true);
      setHasSubscription(true);
      setShowSubscriptionPage(false);
    } catch (err: any) {
      logger.error("Error during subscription process:", err);
      window.alert(
        err?.response?.data?.detail?.message ??
          err?.message ??
          "Error subscribing. Please try again.",
      );
    }
  }, [dispatch, influencer, isSubscribing]);

  return {
    adultMode,
    setAdultMode,
    adultModeSwitch,
    setAdultModeSwitch,
    hasSubscription,
    showSubscriptionPage,
    setShowSubscriptionPage,
    showTermsModal,
    setShowTermsModal,
    showErrorAlert,
    setShowErrorAlert,
    handleAdultModeChange,
    handleSubscribePressed,
  };
}
