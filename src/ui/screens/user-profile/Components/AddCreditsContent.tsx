import React, { useEffect, useState } from "react";
import PrimaryButton from "@/ui/components/inputs/buttons/PrimaryButton";
import IconButton from "@/ui/components/inputs/buttons/IconButton";
import ProfileMedia from "@/ui/components/ProfileMedia";
import styles from "./AddCredits.module.css";
import TextInput from "@/ui/components/inputs/text-inputs/TextInput";
import NormalButton from "@/ui/components/inputs/buttons/NormalButton";
import LoadingSpinner from "@/ui/components/loading/LoadingSpinner";
import { useArmloopCheckout } from "@/hooks/useArmloopCheckout";
import { Modal } from "@/ui/components/modals/Modal";
import { terms } from "@/ui/screens/terms/termsContent";
import CloseIconButton from "@/ui/components/inputs/buttons/CloseIconButton";
import paymentTile from "@/assets/image/TMPaymentTile.png";

type AddCreditsContentProps = {
  influencerId: string;
  influencerName?: string;
  image?: string;
  video?: string;
  isOpen?: boolean;
  onCancel: () => void;
};

const presets = [
  { label: "$10", value: 10 },
  { label: "$50", value: 50 },
  { label: "$100", value: 100 },
];

const MIN_AMOUNT = 5;

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

type AddCreditsStep = "amount" | "payment-note";

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

export default function AddCreditsContent({
  influencerId,
  influencerName,
  image,
  video,
  isOpen,
  onCancel,
}: Readonly<AddCreditsContentProps>) {
  const [amount, setAmount] = useState(0);
  const [step, setStep] = useState<AddCreditsStep>("amount");
  const [showPaymentTerms, setShowPaymentTerms] = useState(false);
  const { startCheckout, loading, error } = useArmloopCheckout();
  const heading = influencerName
    ? `Top up to talk to ${influencerName}`
    : "Top up to talk";

  const handleDecrease = () => setAmount((a) => Math.max(0, a - 10));
  const handleIncrease = () => setAmount((a) => a + 10);

  const handleProceedToPaymentNote = () => {
    if (amount < MIN_AMOUNT) return;
    setStep("payment-note");
  };

  const handleProceedWithPayment = async () => {
    if (amount < MIN_AMOUNT) return;
    await startCheckout({
      influencerId,
      amountCents: Math.round(amount * 100),
      influencerName,
    });
  };

  useEffect(() => {
    if (isOpen === false) {
      setStep("amount");
    }
  }, [isOpen]);

  return (
    <div className={styles.addCredits}>
      {step === "amount" && (
        <ProfileMedia size="large" imageSrc={image} videoSrc={video} active />
      )}

      <div className={styles.selectionBox}>
        {step === "amount" ? (
          <>
            <div className={styles.presetsBox}>
              <h3>{heading}</h3>
              <h4>Quick Presets</h4>
              <div className={styles.presetList}>
                {presets.map((p) => (
                  <IconButton
                    key={p.value}
                    text={p.label}
                    color="black"
                    type="pill"
                    onClick={() => setAmount(p.value)}
                  />
                ))}
              </div>
            </div>

            <div className={styles.customAmountArea}>
              <IconButton
                text={"-"}
                color="black"
                type="pill"
                onClick={handleDecrease}
                className={styles.customBtn}
              />
              <TextInput
                leftIcon="$"
                className={styles.amountInput}
                type="number"
                value={`${amount}`}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                  setAmount(Number(e.target.value) || 0);
                }}
                size="medium"
              />
              <IconButton
                text={"+"}
                color="black"
                type="pill"
                onClick={handleIncrease}
                className={styles.customBtn}
              />
            </div>
          </>
        ) : (
          <div className={styles.paymentNoteStep}>
            <div className={styles.paymentNoteBanner}>
              <p className={styles.paymentNoteBannerText}>
                A quick note before payment
              </p>
            </div>
            <p className={styles.paymentNoteText}>
              On your bank statement, the charge will appear as{" "}
              <span className={styles.paymentNoteBrand}>TeaseMe</span>, and
              funds will be transferred to your{" "}
              {influencerName ?? "influencer"} account balance.
            </p>
            <img
              src={paymentTile}
              alt="Example payment statement entry"
              className={styles.paymentNoteTile}
            />
            <p className={styles.paymentNoteSupport}>
              If you have any questions regarding any charges contact
              support@teaseme.live
            </p>
          </div>
        )}

        {loading ? (
          <div className={styles.loadingState}>
            <LoadingSpinner size="small" />
            <div className={styles.loadingText}>Redirecting to payment…</div>
          </div>
        ) : (
          <>
            <PrimaryButton
              text={step === "amount" ? "Add Credit" : "Proceed with Payment"}
              disabled={amount < MIN_AMOUNT}
              className={styles.confirmBtn}
              onClick={
                step === "amount"
                  ? handleProceedToPaymentNote
                  : handleProceedWithPayment
              }
            />
            <NormalButton
              text="Cancel"
              type="nobg"
              className={styles.confirmBtn}
              onClick={step === "amount" ? onCancel : () => setStep("amount")}
            />
            {error && (
              <div className={styles.payError}>{error}</div>
            )}
          </>
        )}

      </div>
      <button
        type="button"
        className={styles.paymentTermsButton}
        onClick={() => setShowPaymentTerms(true)}
      >
        Payment Terms & Conditions
      </button>
      <Modal
        isOpen={showPaymentTerms}
        onClose={() => setShowPaymentTerms(false)}
        size="md"
        className={styles.paymentTermsModal}
        ariaLabel="Payment Terms and Conditions"
        zIndex={1100}
      >
        <div className={styles.paymentTermsHeader}>
          <div>
            <h3 className={styles.paymentTermsTitle}>Payment Terms & Conditions</h3>
          </div>
          <CloseIconButton
            onClick={() => setShowPaymentTerms(false)}
            className={styles.paymentTermsCloseButton}
            aria-label="Close payment terms"
          />
        </div>
        <div className={styles.paymentTermsScroll}>
          {paymentTermsDocuments.map((document, index) => (
            <section key={document.title} className={styles.paymentTermsDocument}>
              {index > 0 && (
                <h4 className={styles.paymentTermsDocumentTitle}>{document.title}</h4>
              )}
              {document.intro?.map((paragraph, index) => (
                <p key={`${document.title}-intro-${index}`} className={styles.paymentTermsParagraph}>
                  {paragraph}
                </p>
              ))}
              {document.sections.map((section) => (
                <div key={`${document.title}-${section.heading}`} className={styles.paymentTermsSection}>
                  <h5 className={styles.paymentTermsSectionTitle}>{section.heading}</h5>
                  {section.paragraphs.map((paragraph, index) => (
                    <p key={`${document.title}-${section.heading}-${index}`} className={styles.paymentTermsParagraph}>
                      {paragraph}
                    </p>
                  ))}
                  {section.bullets?.length ? (
                    <ul className={styles.paymentTermsList}>
                      {section.bullets.map((bullet, index) => (
                        <li key={`${document.title}-${section.heading}-bullet-${index}`}>
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
    </div>
  );
}
