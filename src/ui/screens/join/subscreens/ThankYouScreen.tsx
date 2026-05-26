import React from "react";
import { useLocation } from "react-router-dom";
import logoTeaseMeOutline from "@/assets/logos/lipsOutline.svg"
import "./ThankYouScreen.css";

type ThankYouVariant = "received" | "profileComplete";

type ThankYouLocationState = {
  variant?: ThankYouVariant;
};

const ThankYouScreen: React.FC = () => {
  const { state } = useLocation();
  const variant = (state as ThankYouLocationState | null)?.variant ?? "received";

  const message =
    variant === "profileComplete"
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
