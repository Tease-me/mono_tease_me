import React, { useState } from "react";
import TextInput from "@/ui/components/inputs/text-inputs/TextInput";
import NormalButton from "@/ui/components/inputs/buttons/NormalButton";
import LoadingSpinner from "@/ui/components/loading/LoadingSpinner";
import CloseIconButton from "@/ui/components/inputs/buttons/CloseIconButton";
import { Modal } from "@/ui/components/modals/Modal";
import { terms } from "@/ui/screens/terms/termsContent";
import { apiClient } from "@/api/apis";
import { GiftCodeServices } from "@/api/services/GiftCodeServices";
import { extractApiError } from "@/utils/extractApiError";
import styles from "./PromoCodeRedeemSection.module.css";

const giftCodeService = GiftCodeServices(apiClient);

type PolicySection = {
  heading: string;
  paragraphs: string[];
  bullets?: string[];
};

type PolicyDocument = {
  title: string;
  lastUpdated: string;
  intro?: string[];
  sections: PolicySection[];
};

const paymentTermsSections = terms.terms.sections.filter(
  (section) =>
    section.heading === "Payments and Digital Credits" ||
    section.heading === "Subscriptions",
);

const paymentTermsDocuments: PolicyDocument[] = [
  {
    title: terms.terms.title,
    lastUpdated: terms.terms.lastUpdated,
    sections: paymentTermsSections,
  },
  terms.refunds,
  terms.subscriptions,
];

type PromoCodeRedeemSectionProps = {
  influencerId: string;
  showPaymentTerms?: boolean;
  onRedeemSuccess?: () => void | Promise<void>;
};

export default function PromoCodeRedeemSection({
  influencerId,
  showPaymentTerms = true,
  onRedeemSuccess,
}: Readonly<PromoCodeRedeemSectionProps>) {
  const [promoCode, setPromoCode] = useState("");
  const [promoLoading, setPromoLoading] = useState(false);
  const [promoError, setPromoError] = useState<string | null>(null);
  const [promoSuccess, setPromoSuccess] = useState<string | null>(null);
  const [showPaymentTermsModal, setShowPaymentTermsModal] = useState(false);

  const handleRedeemPromoCode = async () => {
    const trimmed = promoCode.trim();
    if (!trimmed) {
      setPromoError("Please enter a promo code");
      return;
    }

    setPromoLoading(true);
    setPromoError(null);
    setPromoSuccess(null);

    try {
      let result;
      try {
        result = await giftCodeService.redeemMjpPromoCode(trimmed, influencerId);
      } catch (mjpErr: unknown) {
        const status = (mjpErr as { response?: { status?: number } })?.response?.status;
        if (status !== 404) throw mjpErr;
        result = await giftCodeService.redeemGiftCode(trimmed);
      }
      setPromoSuccess(`${result.diamonds} diamonds added to your balance`);
      setPromoCode("");
      await onRedeemSuccess?.();
    } catch (err: unknown) {
      setPromoError(extractApiError(err, "Unable to redeem promo code"));
    } finally {
      setPromoLoading(false);
    }
  };

  return (
    <>
      <div className={styles.section}>
        <p className={styles.heading}>Do you have a promo code?</p>
        <div className={styles.divider} aria-hidden="true" />
        <TextInput
          className={styles.input}
          placeholder="Enter Code"
          value={promoCode}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
            setPromoCode(e.target.value);
            setPromoError(null);
            setPromoSuccess(null);
          }}
          size="medium"
        />
        {promoLoading ? (
          <div className={styles.loading}>
            <LoadingSpinner size="small" />
          </div>
        ) : (
          <NormalButton
            text="Redeem Code"
            type="pill"
            className={styles.redeemBtn}
            onClick={handleRedeemPromoCode}
            disabled={!promoCode.trim()}
          />
        )}
        {promoError && <p className={styles.error}>{promoError}</p>}
        {promoSuccess && <p className={styles.success}>{promoSuccess}</p>}
        {showPaymentTerms && (
          <button
            type="button"
            className={styles.paymentTermsButton}
            onClick={() => setShowPaymentTermsModal(true)}
          >
            Payment Terms & Conditions
          </button>
        )}
      </div>

      {showPaymentTerms && (
        <Modal
            isOpen={showPaymentTermsModal}
            onClose={() => setShowPaymentTermsModal(false)}
            size="md"
            className={styles.paymentTermsModal}
            ariaLabel="Payment Terms and Conditions"
            zIndex={1100}
          >
            <div className={styles.paymentTermsHeader}>
              <h3 className={styles.paymentTermsTitle}>
                Payment Terms & Conditions
              </h3>
              <CloseIconButton
                onClick={() => setShowPaymentTermsModal(false)}
                className={styles.paymentTermsCloseButton}
                aria-label="Close payment terms"
              />
            </div>
            <div className={styles.paymentTermsScroll}>
              {paymentTermsDocuments.map((document, index) => (
                <section
                  key={document.title}
                  className={styles.paymentTermsDocument}
                >
                  {index > 0 && (
                    <h4 className={styles.paymentTermsDocumentTitle}>
                      {document.title}
                    </h4>
                  )}
                  {document.intro?.map((paragraph, introIndex) => (
                    <p
                      key={`${document.title}-intro-${introIndex}`}
                      className={styles.paymentTermsParagraph}
                    >
                      {paragraph}
                    </p>
                  ))}
                  {document.sections.map((section) => (
                    <div
                      key={`${document.title}-${section.heading}`}
                      className={styles.paymentTermsSection}
                    >
                      <h5 className={styles.paymentTermsSectionTitle}>
                        {section.heading}
                      </h5>
                      {section.paragraphs.map((paragraph, paragraphIndex) => (
                        <p
                          key={`${document.title}-${section.heading}-${paragraphIndex}`}
                          className={styles.paymentTermsParagraph}
                        >
                          {paragraph}
                        </p>
                      ))}
                      {section.bullets?.length ? (
                        <ul className={styles.paymentTermsList}>
                          {section.bullets.map((bullet, bulletIndex) => (
                            <li
                              key={`${document.title}-${section.heading}-bullet-${bulletIndex}`}
                            >
                              {bullet}
                            </li>
                          ))}
                        </ul>
                      ) : null}
                    </div>
                  ))}
                </section>
              ))}
            </div>
          </Modal>
      )}
    </>
  );
}
