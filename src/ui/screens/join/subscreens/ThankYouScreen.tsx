// src/screens/ThankYouScreen.tsx
import React from "react";
import logoTeaseMeOutline from "@/assets/logos/lipsOutline.svg"
import "./ThankYouScreen.css";

const ThankYouScreen: React.FC = () => {
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
            <span className="thanks-subtext-primary">Step 01 of 03 Received!</span>{" "}
            <span>Check your email to begin Step 02</span>
          </p>
        </div>
      </div>
    </div>
  );
};

export default ThankYouScreen;
