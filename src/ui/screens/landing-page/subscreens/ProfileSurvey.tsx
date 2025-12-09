import NormalButton from "@/ui/components/inputs/buttons/NormalButton";
import PrimaryButton from "@/ui/components/inputs/buttons/PrimaryButton";
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";

import SvgPack from "@/utils/SvgPack";
import "./ProfileSurvey.css";
/*
type SocialKey =
  | "instagram"
  | "tiktok"
  | "onlyfans"
  | "snapchat"
  | "x"
  | "telegram"
  | "whatsapp";


const SOCIALS: { key: SocialKey; label: string }[] = [
  { key: "instagram", label: "Instagram" },
  { key: "tiktok", label: "TikTok" },
  { key: "onlyfans", label: "Only Fans" },
  { key: "snapchat", label: "SnapChat" },
  { key: "x", label: "X" },
  { key: "telegram", label: "Telegram" },
  { key: "whatsapp", label: "Whatsapp" },
];
*/
const ProfileSurvey: React.FC = () => {
  const navigate = useNavigate();

  const [name, setName] = useState("");
  const [location, setLocation] = useState("");
  const [email, setEmail] = useState("");

  const handleBack = () => {
    navigate(-1);
  };

  const handleNext = () => {
    navigate("/thank-you");
  };

  return (
    <div className="ps-screen">
      <div className="ps-frame">
        <div className="ps-card">
          <div className="tm-survey-back-button-container">
            <NormalButton
              onClick={handleBack}
              text="Back"
              leftIcon={<SvgPack.ArrowLeft />}
            />
          </div>

          <h2 className="ps-title">Profile Survey</h2>
          <p className="ps-subtitle">Tell us about yourself</p>

          <div className="ps-field">
            <label className="ps-label">
              Full Name <span className="ps-required">*</span>
            </label>
            <input
              className="ps-input"
              placeholder="Your full name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="ps-field">
            <label className="ps-label">
              Location <span className="ps-required">*</span>
            </label>
            <input
              className="ps-input"
              placeholder="Country or Region"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
            />
          </div>

          <div className="ps-field">
            <label className="ps-label">
              Email <span className="ps-required">*</span>
            </label>
            <input
              className="ps-input"
              placeholder="Your email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          {/******************************************************************************
  COMMENTED out SOCIAL Blocks
**************************************************************************************************/}
          {/* <div className="ps-section-title">Socials</div>
          <p className="ps-help">
            Which socials do you use? Activate and fill out your most active
            socials.
          </p>

          <div className="ps-socials-grid">
            {SOCIALS.map((social) => {
              const active = selectedSocials.includes(social.key);
              return (
                <button
                  key={social.key}
                  type="button"
                  className={
                    active ? "ps-social-button active" : "ps-social-button"
                  }
                  onClick={() => toggleSocial(social.key)}
                >
                  {social.label}
                </button>
              );
            })}
          </div> */}

          <div className="tm-survey-button-container">
            <PrimaryButton
              onClick={handleNext}
              text="Next"
              rightIcon={<SvgPack.ArrowRight />}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProfileSurvey;
