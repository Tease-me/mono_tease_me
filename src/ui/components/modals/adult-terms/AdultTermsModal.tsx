import UnifiedPopup from "@/ui/components/modals/UnifiedPopup";
import styles from "./AdultTermsModal.module.css";
import SvgPack from "@/utils/SvgPack";
import PrimaryButton from "@/ui/components/inputs/buttons/PrimaryButton";
import NormalButton from "@/ui/components/inputs/buttons/NormalButton";
import { apiClient } from "@/api/apis";
import logger from "@/utils/logger";

import { AdultVerificationSerivces } from "@/api/services/AdultVerificationServices";
import { LocalStorageKeys } from "@/constants/localStorageKeys";
import { storage } from "@/utils/storage";

type AdultTermsModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onAgree: () => void;
  onDecline?: () => void;
  influencerId: string;
  influencerName?: string | null;
  influencerImageUrl?: string | null;
};

export default function AdultTermsModal({
  isOpen,
  onClose,
  onDecline,
  influencerId,
  influencerName,
  influencerImageUrl,
}: AdultTermsModalProps) {
  const verificationService = AdultVerificationSerivces(apiClient);

  const handleAgree = async () => {
    try {
      const verificationSession =
        await verificationService.startVerificationSession();
      verificationSession?.response?.data?.session_id;
      const url = verificationSession?.verification_url;
      if (!url) {
        alert("No URL found");
        throw new Error("No verification URL returned");
      }
      const targetData = JSON.stringify({
        influencerId: influencerId,
        img: influencerImageUrl,
        name: influencerName,
      });
      storage.set(LocalStorageKeys.AdultVerificationTarget, targetData);
      window.location.href = url;
    } catch (err: any) {
      logger.error(err);
    }
  };

  const header = (
    <>
      <div className={styles.header}>
        <div className={styles.topLine}></div>
        <button className={styles.close} aria-label="Close" onClick={onClose}>
          <SvgPack.Cross />
        </button>
      </div>
      <div className={styles.headerTitle}>
        <div className={styles.title}>You need to be 18+ to proceed</div>
        <p className={styles.subtitle}>
          Please read the terms and conditions below. If you agree to them we
          will begin age verification.
        </p>
      </div>
    </>
  );

  const body = (
    <div className={styles.container}>
      <div className={styles.titleContainer}>
        <div className={styles.title}>Adult Content Policy</div>
        <p className={styles.subtitle}>Last updated: 23 December 2025</p>
      </div>
      <section className={styles.section}>
        <p>
          This Adult Content Policy governs access to and use of age-restricted
          features provided by TeaseMe. By accessing any adult features, you
          confirm that you are at least eighteen (18) years of age and agree to
          comply with this policy.
        </p>
      </section>

      <section className={styles.section}>
        <h4>Age Restriction</h4>
        <p>
          Adult features are strictly limited to users who are at least eighteen
          (18) years old. By enabling or accessing adult features, you represent
          and warrant that you meet this age requirement.
        </p>
        <p>
          TeaseMe reserves the right to suspend or terminate access to adult
          features if age eligibility is misrepresented or cannot be reasonably
          verified.
        </p>
      </section>

      <section className={styles.section}>
        <h4>Permitted Adult Content</h4>
        <p>
          Adult content available on the platform is intended solely for
          consensual, lawful, fictional, and simulated adult entertainment
          purposes. All adult interactions are generated through automated
          systems and do not involve live human participation.
        </p>
      </section>

      <section className={styles.section}>
        <h4>Prohibited Content</h4>
        <p>
          No content that is illegal, exploitative, abusive, harmful, or
          non-consensual is permitted under any circumstances. Content involving
          minors, coercion, trafficking, violence, bestiality, incest, or any
          form of sexual exploitation is strictly prohibited.
        </p>
      </section>

      <section className={styles.section}>
        <h4>User Responsibility</h4>
        <p>
          Users are solely responsible for ensuring that their use of adult
          features complies with all applicable laws in their jurisdiction.
          TeaseMe does not guarantee that adult content is lawful in every
          jurisdiction and assumes no responsibility for user compliance with
          local regulations.
        </p>
      </section>

      <section className={styles.section}>
        <h4>Moderation and Enforcement</h4>
        <p>
          TeaseMe reserves the right to monitor, restrict, remove, or block
          adult content and user access where violations of this policy or
          applicable laws are identified. Violations may result in immediate
          suspension or termination of access to adult features and/or the
          platform.
        </p>
      </section>

      <section className={styles.section}>
        <h4>No Professional or Real Relationship Representation</h4>
        <p>
          All adult interactions are fictional, simulated, and for entertainment
          purposes only. No content represents real relationships, real persons,
          or real emotional commitments.
        </p>
      </section>

      <section className={styles.section}>
        <h4>Policy Updates</h4>
        <p>
          This Adult Content Policy may be updated at any time. Continued use of
          adult features constitutes acceptance of any revised terms.
        </p>
      </section>

      <section className={styles.section}>
        <h4>Contact</h4>
        <p>
          Questions regarding this policy may be directed to
          support@teaseme.live
        </p>
      </section>
    </div>
  );

  const footer = (
    <>
      <div className={styles.actions}>
        <PrimaryButton
          variant="purple"
          text="I Agree, Let’s Verify My Age"
          onClick={handleAgree}
          className={styles.primaryBtn}
        />
        <NormalButton
          type="nobg"
          text="I don’t agree, take me back"
          onClick={onDecline ?? onClose}
          className={styles.secondaryBtn}
        />
      </div>
    </>
  );

  return (
    <UnifiedPopup
      isOpen={isOpen}
      onClose={onClose}
      size="lg"
      header={header}
      body={body}
      footer={footer}
      className={styles.modal}
      ariaLabel="Adult terms and age verification"
    />
  );
}
