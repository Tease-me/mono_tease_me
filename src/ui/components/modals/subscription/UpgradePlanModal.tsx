import UnifiedPopup from "../UnifiedPopup";
import SvgPack from "@/utils/SvgPack";
import { useQuery } from "@tanstack/react-query";
import { SubscriptionsServices } from "@/api/services/SubscriptionsServices";
import { apiClient } from "@/api/apis";
import AddonButton from "../../inputs/buttons/AddonButton";
import PrimaryButton from "../../inputs/buttons/PrimaryButton";
import LoadingSpinner from "@/ui/components/loading/LoadingSpinner";
import styles from "./UpgradePlanModal.module.css";

type UpgradePlanModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onUpgrade?: () => void;
};


export default function UpgradePlanModal({ isOpen, onClose, onUpgrade }: UpgradePlanModalProps) {
  const subscriptionPlanSvc = SubscriptionsServices(apiClient);

  const { data, isLoading, error } = useQuery({
    queryKey: ["subscriptionPlans"],
    queryFn: () => subscriptionPlanSvc.getPlans(),
    staleTime: Infinity,
  }
  );

  const plans = data?.addons ?? [];

  const handleUpgrade = () => {
    onClose();
    onUpgrade?.();
  };


  const header = (
    <>
      <div className={styles.header}>
        <div className={styles.topLine}></div>
        <button className={styles.close} aria-label="Close" onClick={onClose}>
          <SvgPack.Cross />
        </button>
      </div>
      <div className={styles.sectionUpgrade}>
        <div className={styles.title1}>
          You’re out of time
        </div>
        <div className={styles.subtitle}>
          Your are out of credits. Upgrade now to keep the conversation going.
        </div>
        <PrimaryButton
          variant="purple"
          text="Upgrade Your Plan"
          className={styles.upgradeBtn}
          onClick={handleUpgrade}
        />
      </div>
    </>
  );

  const body = (
    <div className={styles.container}>
      {isLoading ? (
        <div className={styles.loading}><LoadingSpinner /></div>
      ) : error ? (
        <div className={styles.error}>Couldn’t load plans.</div>
      ) : (
        <div className={styles.content}>
          <div className={styles.sectionAddon}>
            <div className={styles.title1}>
              Continue the conversation
            </div>
            <div className={styles.subtitle}>
              Choose a call time pack to stay connected.
            </div>
            {plans.map((plan) => (
              <div key={plan.id} className={styles.addonRow}>
                <div className={styles.addonText}>
                  <span className={styles.title2}>{plan.name}</span>
                  <span className={styles.addonDesc}>{plan.description}</span>
                </div>
                <AddonButton
                  variant="outline"
                  text={`$${(plan.price_cents / 100).toFixed(2)}`}
                  onClick={() => { }}
                />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );

  return (
    <UnifiedPopup
      isOpen={isOpen}
      onClose={onClose}
      size="xl"
      horizontalOnDesktop={true}
      className={styles.modal}
      header={header}
      body={body}
    />
  );
}
