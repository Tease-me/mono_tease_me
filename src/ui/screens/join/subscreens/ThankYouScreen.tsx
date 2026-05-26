import React from "react";
import { useSearchParams } from "react-router-dom";
import logoTeaseMeOutline from "@/assets/logos/lipsOutline.svg"
import { THANK_YOU_VARIANTS, type ThankYouVariant } from "./thankYouVariants";
import "./ThankYouScreen.css";

const ThankYouScreen: React.FC = () => {
  const [searchParams] = useSearchParams();
  const variantParam = searchParams.get("variant");
  const variant: ThankYouVariant =
    variantParam === THANK_YOU_VARIANTS.profileComplete || variantParam === THANK_YOU_VARIANTS.received
      ? variantParam
      : THANK_YOU_VARIANTS.received;

  const message =
    variant === THANK_YOU_VARIANTS.profileComplete
      ? {
          primary: "Your Profile is complete",
          secondary: "Your account manager will contact you when it's live",
        }
      : {
          primary: "Step 01 of 03 Received!",
          secondary: "Check your email to begin Step 02",
        };

  return (
    <div className="dialog-screen">
      <div className="dialog-frame">
        <div className="thanks-card">
          <div className="thanks-icon">
            <img src={logoTeaseMeOutline} alt="Tease Me" className="tm-logo-outline" />
          </div>

          <h1 className="thanks-title">Thank You!</h1>

          <div className="thanks-pill">We have received your submission</div>

          <p className="thanks-subtext">
            <span className="thanks-subtext-primary">{message.primary}</span>
            <span>{message.secondary}</span>
          </p>
        </div>
      </div>
    </div>
  );
};

export default ThankYouScreen;
