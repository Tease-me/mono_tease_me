import { useQuery } from "@tanstack/react-query"
import { SubscriptionsServices } from "@/api/services/SubscriptionsServices";
import { apiClient } from "@/api/apis";
import clsx from "clsx"

import PricingPlanCard from "@/ui/components/cards/PricingPlanCard";
import styles from "./Subscription.module.css";
import LoadingSpinner from "@/ui/components/loading/LoadingSpinner";


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
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchOnMount: false,
  }
  );

  const recurringPlans = data?.recurring ?? [];

  return (
    <div className={clsx(styles.container, "u-sidebar-page")} >
      {isLoading && <div className={styles.loading}><LoadingSpinner /></div>}
      {error && <div className={styles.error}>Couldn’t load plans</div>}
      <div className={styles.cards}>
        {recurringPlans.map((plan) => (
          <div key={plan.id} className={styles.card}>
            <PricingPlanCard
              title={plan.name}
              price={(plan.price_cents / 100).toFixed(2)}
              callTime={`${plan.features.minutes_equivalent ?? 0} min`}
              active={plan.is_featured}
            />
          </div>
        ))}
      </div>
    </div>
  );

};

export default Subscription;
