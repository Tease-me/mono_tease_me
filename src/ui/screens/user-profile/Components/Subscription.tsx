import PricingPlanCard from "@/ui/components/cards/PricingPlanCard";
import styles from "./Subscription.module.css";

type SubscriptionProps = {
  goTo: (id: string, payload?: Record<string, any>) => void;
  navPayload?: Record<string, any>;
  goBack?: () => void;
};

const Subscription = ({ goTo, navPayload, goBack }: SubscriptionProps) => {
  return (
    <div className={styles.container}>
      <div className={styles.cards}>
        <div className={styles.card}>
          <PricingPlanCard title="Basic" price="200.00" callTime="100 min" />
        </div>
        <div className={styles.card}>
          <PricingPlanCard title="Plus" price="149.00" callTime="200 min" active />
        </div>
        <div className={styles.card}>
          <PricingPlanCard title="Premium" price="500.00" callTime="600 min" />
        </div>
      </div>
    </div>
  );
};

export default Subscription;
