import { useEffect, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { SubscriptionsServices } from "@/api/services/SubscriptionsServices";
import { apiClient } from "@/api/apis";
import clsx from "clsx"

import PricingPlanCard from "@/ui/components/cards/PricingPlanCard";
import styles from "./Subscription.module.css";
import LoadingSpinner from "@/ui/components/loading/LoadingSpinner";
import AddonButton from "@/ui/components/inputs/buttons/AddonButton";
import PrimaryButton from "@/ui/components/inputs/buttons/PrimaryButton";
import SvgPack from "@/utils/SvgPack";

import { Modal } from "@/ui/components/modals/Modal";

type SubscriptionProps = {
  goTo: (id: string, payload?: Record<string, any>) => void;
  navPayload?: Record<string, any>;
  goBack?: () => void;
};


const Subscription = ({ goTo, }: SubscriptionProps) => {

  const subscriptionPlanSvc = SubscriptionsServices(apiClient);

  const { data, isLoading, error } = useQuery({
    queryKey: ["subscriptionPlans"],
    queryFn: () => subscriptionPlanSvc.getPlans(),
    staleTime: Infinity,
  }
  );
  const recurringPlans = data?.recurring ?? [];
  const addOns = data?.addons ?? [];

  const featuredPlan = recurringPlans.find((p) => p.is_featured)?.id;
  const [selectedPlanId, setSelectedPlanId] = useState<number | null>(null);

  useEffect(() => {
    if (!recurringPlans.length) return;
    const fallback = featuredPlan ?? recurringPlans[0]?.id ?? null;
    setSelectedPlanId((prev) => prev ?? fallback);
  }, [featuredPlan, recurringPlans]);

  const selectedPlan =
    recurringPlans.find((p) => p.id === selectedPlanId) ||
    recurringPlans.find((p) => p.is_featured) ||
    recurringPlans[0] ||
    null;

  const [showAddonInfoModal, setShowAddonInfoModal] = useState(false);

  const handleClickAddon = () => {

  }

  const handleOnSubscribeClick = () => {
    goTo("payment-check");
  }

  function centsToDollar(cents: number) {
    return (cents / 100).toFixed(2);

  }

  if (isLoading) return <div className={styles.loading}><LoadingSpinner /></div>;
  if (error) return <div className={styles.error}>Couldn’t load plans</div>;

  return (
    <div className={clsx(styles.container, "u-sidebar-page")} >
      <div className={styles.content}>
        <div className={styles.cards}>
          {recurringPlans.map((plan) => (
            <div key={plan.id} className={styles.card}>
              <PricingPlanCard
                title={plan.name}
                price={centsToDollar(plan.price_cents)}
                callTime={`${plan.features.minutes_equivalent ?? 0} min`}
                active={selectedPlanId === plan.id}
                onClick={() => setSelectedPlanId(plan.id)}
              />
              <div><span className={styles.red}>18+ </span>only</div>
            </div>
          ))}
        </div>
        <div className={styles.divider}></div>
        <div className={styles.addOnArea}>
          <div className={styles.spread}>
            <span className={styles.title}>
              Add On Packages
            </span>
            <SvgPack.InfoCircle className={styles.infoIcon} onClick={() => setShowAddonInfoModal(true)} />
          </div>
          <span className={styles.subtitle}>
            One-time add-ons available with an active subscription.
          </span>

          <div >
            {addOns.map((addOn) => (
              <div key={addOn.id} className={styles.addOns}>
                <div className={styles.addOnContent}>
                  <span className={styles.title2}>{addOn.name}</span>
                  <span className={styles.subtitle}>{addOn.description}</span>
                </div>
                <AddonButton variant="outline" text={`$${centsToDollar(addOn.price_cents)}`}
                  onClick={handleClickAddon} />
                {/* <AddonButton variant="outline" text={`${addOn.price_display}`} /> */}
                <div className={styles.divider}></div>

              </div>
            ))}

          </div>
        </div>
      </div>
      <div className={styles.sticky}>
        <span className={styles.title}>
          Let's heat things up...
        </span>
        <PrimaryButton
          variant="purple"
          text={
            selectedPlan
              ? `Subscribe for $${centsToDollar(selectedPlan.price_cents)}`
              : "Subscribe"
          }
          onClick={handleOnSubscribeClick}
        />
        <span className={styles.note}>
          You will be charged, your subscription will auto-renew for the same price and package length until you cancel via account settings, and you agree to our Terms.
        </span>
      </div>
      <Modal onClose={() => setShowAddonInfoModal(false)} isOpen={showAddonInfoModal} className={styles.addOnInfoModal} closeOnOverlayClick={false}>
        <button
          type="button"
          aria-label="Close"
          className={styles.modalClose}
          onClick={() => setShowAddonInfoModal(false)}
        >
          <SvgPack.Cross />
        </button>
        <div className={styles.title}>
          How call minutes work
        </div>
        <div className={styles.subtitle}>Subscription minutes are used first, starting with higher-tier plans. Add-on minutes are used after and don’t auto-renew. Add-ons can be stacked, and minutes are deducted based on actual call duration.</div>
      </Modal>
    </div>

  );

};

export default Subscription;
