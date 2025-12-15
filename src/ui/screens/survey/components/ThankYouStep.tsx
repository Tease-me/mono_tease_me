import React from "react";
import styles from "./ThankYouStep.module.css";
import TeaseMeLogo from "@/ui/components/logos/TeaseMeLogo";

const ThankYouStep: React.FC = () => {
  return (
    <div className={styles.container}>
      <div className={styles.iconBubble}>
        <span role="img" aria-label="Thank you">
          <TeaseMeLogo />
        </span>
      </div>
      <h2 className={styles.title}>Thank You!</h2>
      <div className={styles.pill}>We have received your submission</div>
      <p className={styles.body}>
        An account manager will contact you shortly to discuss the final steps.
      </p>
      <p className={styles.bodyMuted}>
        If you haven’t heard back in 24 hours please use the link below
      </p>
      <a className={styles.link} href="mailto:support@teaseme.ai">
        Contact Us
      </a>
    </div>
  );
};

export default ThankYouStep;
