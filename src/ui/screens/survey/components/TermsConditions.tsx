import React, { useEffect, useState } from "react";
import "./terms-conditions.css";
import UnifiedPopup from "@/ui/components/modals/UnifiedPopup";
import PrimaryButton from "@/ui/components/inputs/buttons/PrimaryButton";
import NormalButton from "@/ui/components/inputs/buttons/NormalButton";
import CheckBox from "@/ui/components/inputs/check-boxes/CheckBox";

const TermsContent: React.FC = () => (
  <section className="tm-terms" aria-labelledby="tm-title">
    <h2 className="tm-terms_heading">Terms and Conditions</h2>

    {/* ── Content Agreement ── */}
    <header className="tm-terms__header">
      <h2 className="tm-terms__title">Content Agreement</h2>
      <p className="tm-terms__subtitle">
        This Agreement is entered into by and between TeaseMe (the "Company") and the individual signing this agreement (the "Creator").
        By providing assets to the Company and accessing the TeaseMe platform, the Creator agrees to the following terms:
      </p>
    </header>

    <div className="tm-terms__body">
      <article className="tm-clause">
        <h3 className="tm-clause__title">1. Age Representation &amp; Verification</h3>
        <p className="tm-clause__text">
          The Creator hereby warrants and represents that they are at least 18 years of age (or the legal age of majority in their jurisdiction).
          The Creator understands that providing false information regarding their age is a violation of law and will result in immediate termination
          of this agreement and potential legal action.
        </p>
      </article>

      <article className="tm-clause">
        <h3 className="tm-clause__title">2. Grant of License</h3>
        <p className="tm-clause__text">
          The Creator grants TeaseMe a non-exclusive, worldwide, royalty-free license to use the image and video library provided by the Creator
          (the "Assets") for the purpose of creating, promoting, and operating an AI version of the Creator's likeness (the "Persona").
        </p>
      </article>

      <article className="tm-clause">
        <h3 className="tm-clause__title">3. Authorization for Synthetic Content</h3>
        <p className="tm-clause__text">
          The Creator expressly grants TeaseMe permission to use the Assets as training data or reference material for generative artificial
          intelligence. This includes, but is not limited to:
        </p>
        <ul className="tm-list">
          <li><strong>Landing Pages:</strong> The creation of marketing visuals and promotional banners.</li>
          <li><strong>Synthetic Scenarios:</strong> The creation of "synthetic scenarios," wherein AI is used to generate images or videos of the Creator in digital environments, settings, or situations that were not present in the original Assets provided.</li>
          <li><strong>AI Marketing Materials:</strong> The generation of synthetic imagery for use on social media and other marketing channels to promote the TeaseMe Persona.</li>
        </ul>
      </article>

      <article className="tm-clause">
        <h3 className="tm-clause__title">4. Limitation of Use (Marketing Only)</h3>
        <p className="tm-clause__text">
          The license granted herein is strictly for marketing and persona-development purposes. TeaseMe agrees that it shall not sell the
          Creator's raw Assets as standalone products to third parties. The use of synthetic imagery is intended solely to attract users to the
          Persona and enhance the user experience within the TeaseMe ecosystem.
        </p>
      </article>

      <article className="tm-clause">
        <h3 className="tm-clause__title">5. Ownership</h3>
        <p className="tm-clause__text">
          <strong>Original Assets:</strong> The Creator retains all ownership rights to the original images and videos provided to the Company.
        </p>
        <p className="tm-clause__text">
          <strong>Derived Works:</strong> Any AI-generated imagery, synthetic scenarios, or marketing materials created by TeaseMe shall be
          owned by the Company for the duration of this agreement.
        </p>
      </article>

      <article className="tm-clause">
        <h3 className="tm-clause__title">6. Withdrawal of Consent &amp; Right to Be Forgotten</h3>
        <p className="tm-clause__text">The Creator maintains the right to withdraw their consent and request the deletion of their Persona.</p>
        <p className="tm-clause__text"><strong>Request Process:</strong> To initiate a deletion, the Creator must submit a written request to the Company.</p>
        <p className="tm-clause__text"><strong>Deletion Timeline:</strong> Upon receipt of a valid request, TeaseMe agrees to delete the AI Persona and remove associated marketing assets from active use within fourteen (14) calendar days.</p>
        <p className="tm-clause__text"><strong>Final Payment:</strong> Upon termination of this agreement via withdrawal of consent, TeaseMe will calculate and issue any outstanding payments owed to the Creator up to the date of the deletion request.</p>
      </article>

      <article className="tm-clause">
        <h3 className="tm-clause__title">7. Indemnification &amp; Warranties</h3>
        <p className="tm-clause__text">
          The Creator warrants that they have the full legal right to grant this license and that the Assets provided do not infringe upon the
          intellectual property or privacy rights of any third party. The Creator agrees to indemnify TeaseMe against any claims arising from
          a breach of these warranties.
        </p>
      </article>

      {/* ── Voice & Content Terms ── */}
      <article className="tm-clause">
        <h3 className="tm-clause__title">8. Content and Influencer Voice Models; Models</h3>
        <p className="tm-clause__text">
          TeaseMe uses influencer voices only for chat services on the TeaseMe platform, and (only if the influencer opts in) for TeaseMe
          marketing/advertising.
        </p>
      </article>

      <article className="tm-clause" id="tm-4a">
        <h3 className="tm-clause__title">(a) Inputs and Outputs</h3>
        <p className="tm-clause__text">
          You may transmit or otherwise provide data and information as input to the TeaseMe services (the "Services") ("<strong>Input</strong>").
          When you provide Input to the Services, you may receive: (i) audio output generated using an Influencer Voice Model (defined below)
          and/or (ii) text output generated by language models, in each case based on your Input ("<strong>Output</strong>"). Input and Output
          together are "<strong>Content</strong>."
        </p>
        <p className="tm-clause__text">
          Input may include, without limitation, text prompts, messages, metadata, and (where applicable) audio recordings provided by an
          Influencer or other authorized party. Your access to and use of the Services (including providing Input and receiving Output) is
          subject to these Terms and any applicable policies referenced by TeaseMe.
        </p>
        <p className="tm-clause__text">
          TeaseMe may allow you to download certain Output, if enabled. Any downloaded Output remains subject to these Terms.
        </p>
      </article>

      <article className="tm-clause" id="tm-4b">
        <h3 className="tm-clause__title">(b) Influencer Voice Models</h3>
        <p className="tm-clause__text">
          Some Services allow an influencer/creator ("<strong>Influencer</strong>") to create a voice model that can generate synthetic audio
          resembling the Influencer's voice (an "<strong>Influencer Voice Model</strong>"). To create an Influencer Voice Model, the Influencer
          may be required to upload voice recordings as Input ("<strong>Voice Recordings</strong>").
        </p>
        <div className="tm-callout" role="note" aria-label="Scope limitation">
          <p className="tm-callout__title">Scope limitation</p>
          <p className="tm-callout__text">
            TeaseMe will use an Influencer's Voice Recordings and Influencer Voice Model <strong>only</strong>:
          </p>
          <ol className="tm-list tm-list--ordered">
            <li>
              to provide chat and related conversational features <strong>within the TeaseMe platform</strong> using that Influencer's approved
              voice experience; and
            </li>
            <li>
              <strong>if the Influencer opts in (or otherwise expressly agrees in writing),</strong> to create TeaseMe marketing/advertising
              materials that promote TeaseMe and/or that Influencer's TeaseMe presence (e.g., promos, trailers, paid ads, app store previews).
            </li>
          </ol>
          <p className="tm-callout__text">
            TeaseMe will <strong>not</strong> sell, license, or commercialize an Influencer's voice on a standalone basis or for third-party
            use outside TeaseMe, and will <strong>not</strong> make the Influencer Voice Model available to other customers as a general voice
            asset, except as required to operate the Influencer's own TeaseMe chat experience.
          </p>
        </div>
      </article>

      <article className="tm-clause" id="tm-4c">
        <h3 className="tm-clause__title">(c) Rights to Your Content</h3>
        <ul className="tm-list">
          <li>As between you and TeaseMe, you retain all rights you have in and to your <strong>Input</strong>.</li>
          <li>As between you and TeaseMe, you retain all rights you have in and to your <strong>Output</strong>, to the extent you hold such rights.</li>
        </ul>
        <p className="tm-clause__text">
          For clarity, TeaseMe retains all rights in and to: (1) the Services, (2) TeaseMe's software, workflows, safety systems, and underlying
          technology, and (3) any foundational models or systems used to generate Output (collectively, the "<strong>Models</strong>"), excluding
          an Influencer's separate rights in their own voice, likeness, persona, and Voice Recordings.
        </p>
      </article>

      <article className="tm-clause" id="tm-4d">
        <h3 className="tm-clause__title">(d) Limited License to Use Your Input (including Voice Recordings)</h3>
        <p className="tm-clause__text">
          You grant TeaseMe a <strong>limited</strong> license to use your Input solely to operate the Services as described in these Terms,
          including to host, store, process, reproduce, and create derivative works of Input <strong>only to the extent necessary</strong> to:
        </p>
        <ul className="tm-list">
          <li>provide and maintain the Services;</li>
          <li>generate Output requested through the Services;</li>
          <li>enforce safety, trust, fraud prevention, and policy compliance; and</li>
          <li>troubleshoot, secure, and improve the reliability and performance of the Services <strong>without using an Influencer's Voice Recordings to create or improve voice models for anyone other than that Influencer</strong>, unless separately agreed in writing.</li>
        </ul>
        <p className="tm-clause__text">
          <strong>Term &amp; revocability:</strong> This license lasts for as long as your account (or the relevant Influencer account) remains
          active and for a reasonable period afterward to comply with legal obligations, resolve disputes, and maintain backups/security logs,
          after which TeaseMe will delete or de-identify data in accordance with its Privacy Policy and applicable law.
        </p>
        <p className="tm-clause__text">
          <strong>Service providers:</strong> TeaseMe may share Input with vendors/sub-processors solely to provide the Services, under
          confidentiality and data-protection obligations.
        </p>
      </article>

      <article className="tm-clause" id="tm-4e">
        <h3 className="tm-clause__title">(e) Limited License to Use Influencer Voice Models</h3>
        <p className="tm-clause__text">
          To the extent an Influencer owns or acquires any intellectual property rights in an Influencer Voice Model, the Influencer grants
          TeaseMe a <strong>limited</strong> license to use that Influencer Voice Model only to:
        </p>
        <ul className="tm-list">
          <li>generate audio Output for chat/conversational experiences on TeaseMe for that Influencer; and</li>
          <li>if the Influencer opts in (or expressly agrees in writing), generate audio for TeaseMe marketing/advertising that promotes TeaseMe and/or the Influencer's TeaseMe presence.</li>
        </ul>
        <p className="tm-clause__text">
          TeaseMe will not transfer or sublicense an Influencer Voice Model for third-party use outside TeaseMe, except to service providers
          strictly for operating TeaseMe (under confidentiality and data-protection obligations).
        </p>
      </article>

      <article className="tm-clause" id="tm-4f">
        <h3 className="tm-clause__title">(f) Advertising / Marketing Use (Opt-in Recommended)</h3>
        <p className="tm-clause__text">
          If enabled by the Influencer (or agreed in writing), TeaseMe may use short samples of Output generated using the Influencer Voice
          Model and/or edited excerpts of Voice Recordings provided for TeaseMe, solely in TeaseMe promotional content (paid ads, social posts,
          website, app store media, press demos). If the Influencer withdraws marketing permission, TeaseMe will stop creating new marketing
          materials using the Influencer's voice and will use commercially reasonable efforts to phase out active campaigns, acknowledging that
          already-published materials and placements may take time to remove.
        </p>
      </article>

      <article className="tm-clause" id="tm-4g">
        <h3 className="tm-clause__title">(g) Necessary Rights</h3>
        <p className="tm-clause__text">
          You may not provide Input (including Voice Recordings) unless you have all rights necessary to do so. You represent and warrant that
          you have the right to provide the Input to TeaseMe, and TeaseMe's permitted use of the Input and any Influencer Voice Model under
          these Terms will not violate any third-party rights (including privacy, publicity, copyright, or trademark).
        </p>
      </article>

      <article className="tm-clause" id="tm-4h">
        <h3 className="tm-clause__title">(h) No Sensitive / Regulated Data</h3>
        <p className="tm-clause__text">
          You must not provide Input containing sensitive personal data or regulated information (including protected health information) unless
          TeaseMe has expressly agreed in writing and required safeguards are in place.
        </p>
      </article>

      <article className="tm-clause" id="tm-4i">
        <h3 className="tm-clause__title">(i) Data Deletion and Model Deletion</h3>
        <p className="tm-clause__text">
          You may request deletion of personal data as required under applicable law. Influencers may request deletion of their Voice Recordings
          and Influencer Voice Model via account settings or TeaseMe support (if applicable). TeaseMe may retain limited records as required for
          legal, security, fraud prevention, and compliance purposes.
        </p>
      </article>

      <article className="tm-clause" id="tm-4j">
        <h3 className="tm-clause__title">(j) Moderation</h3>
        <p className="tm-clause__text">
          TeaseMe does not undertake to review all Content and disclaims any obligation to monitor Content. However, TeaseMe may, at any time:
          remove or restrict Content or Output; suspend or terminate access to the Services; and/or take actions necessary to comply with law,
          enforce these Terms, and protect users, TeaseMe, or third-party rights.
        </p>
      </article>
    </div>
  </section>
);

type TermsModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onAccept: () => void;
  accepting?: boolean;
  error?: string | null;
};

export const TermsModal: React.FC<TermsModalProps> = ({
  isOpen,
  onClose,
  onAccept,
  accepting = false,
  error,
}) => {
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    if (!isOpen) setChecked(false);
  }, [isOpen]);

  const footer = (
    <div className="terms-modal__footer">
      <div className="terms-modal__checkbox">
        <CheckBox checked={checked} onChange={(val) => setChecked(val)}>
          I have read and agree to the Terms and Conditions.
        </CheckBox>
      </div>
      <div className="terms-modal__actions">
        <NormalButton text="Cancel" onClick={onClose} />
        <PrimaryButton
          text={accepting ? "Accepting..." : "Accept"}
          disabled={!checked || accepting}
          onClick={onAccept}
        />
      </div>
      {error && <div className="terms-modal__error">{error}</div>}
    </div>
  );

  return (
    <UnifiedPopup
      isOpen={isOpen}
      onClose={onClose}
      size="lg"
      body={<TermsContent />}
      footer={footer}
      ariaLabel="Terms and Conditions"
    />
  );
};

export default function TermsConditions() {
  return <TermsContent />;
}
