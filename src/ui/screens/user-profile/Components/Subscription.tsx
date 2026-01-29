import { useQuery } from "@tanstack/react-query"
import { SubscriptionsServices } from "@/api/services/SubscriptionsServices";
import { apiClient } from "@/api/apis";
import clsx from "clsx"

import PricingPlanCard from "@/ui/components/cards/PricingPlanCard";
import styles from "./Subscription.module.css";
import LoadingSpinner from "@/ui/components/loading/LoadingSpinner";
import AddonButton from "@/ui/components/inputs/buttons/AddonButton";
import PrimaryButton from "@/ui/components/inputs/buttons/PrimaryButton";

type SubscriptionProps = {
  goTo: (id: string, payload?: Record<string, any>) => void;
  navPayload?: Record<string, any>;
  goBack?: () => void;
};




const Subscription = ({ }: SubscriptionProps) => {

  const subscriptionPlanSvc = SubscriptionsServices(apiClient)

  const { data, isLoading, error } = useQuery({
    queryKey: ["subscriptionPlans"],
    queryFn: () => subscriptionPlanSvc.getPlans(),
    staleTime: Infinity,
  }
  );

  const recurringPlans = data?.recurring ?? [];
  const addOns = data?.addons ?? [];

  const handleClickAddon = () => {

  }

  const handleOnSubscribeClick = () => {

  }

  return (
    <div className={clsx(styles.container, "u-sidebar-page")} >
      {isLoading && <div className={styles.loading}><LoadingSpinner /></div>}
      {error && <div className={styles.error}>Couldn’t load plans</div>}
      <div className={styles.content}>
        <div className={styles.cards}>
          {recurringPlans.map((plan) => (
            <div key={plan.id} className={styles.card}>
              <PricingPlanCard
                title={plan.name}
                price={(plan.price_cents / 100).toFixed(2)}
                callTime={`${plan.features.minutes_equivalent ?? 0} min`}
                active={plan.is_featured}
              />
              <div><span className={styles.red}>18+ </span>only</div>
            </div>
          ))}
        </div>
        <div className={styles.divider}></div>
        <div className={styles.addOnArea}>
          <span className={styles.title}>
            Add On Packages
          </span>
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
                <AddonButton variant="outline" text={`$${(addOn.price_cents / 100).toFixed(2)}`}
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
        <PrimaryButton variant="purple" text="Subscribe for ---" onClick={handleOnSubscribeClick} />
        <span className={styles.note}>
          You will be charged, your subscription will auto-renew for the same price and package length until you cancel via account settings, and you agree to our Terms.
        </span>
      </div>
    </div>
  );

};

export default Subscription;
