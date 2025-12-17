import PrimaryButton from "@/ui/components/inputs/buttons/PrimaryButton";
import TeaseMeLogo from "@/ui/components/logos/TeaseMeLogo";
import SvgPack from "@/utils/SvgPack";
import React, { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import imageProfile from "@/assets/image/imageProfile.jpg";
import imageTeaseMeDark from "@/assets/image/iconTeaseMeDark.png";
import imageTeaseMeDark2x from "@/assets/image/iconTeaseMeDark@2x.png";
import CircularIconButton from "@/ui/components/inputs/buttons/CircularIconButton";
import CloseSquareIcon from "@/assets/CloseSquare.svg?react";
import CallIcon from "@/assets/Call.svg?react";
import "./HomePage.css";
import IconButton from "@/ui/components/inputs/buttons/IconButton";

const InfluencerHome: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [timer] = useState("00:15");

  // Get influencer name from location state or use default
  const influencerName = (location.state as any)?.influencerName || "[name]";
  const influencerAvatar =
    (location.state as any)?.influencerAvatar ||
    "http://localhost:3845/assets/c3e26383390815960d27655711a1051f74ce5d16.png";

  const handleTalkNow = () => {
    // TODO: Navigate to call/chat screen
    //console.log("Talk to", influencerName);
  };

  return (
    <div className="influencer-home">
      {/* Header */}
      <header className="influencer-header">
        <TeaseMeLogo variant="full-dark" size="medium" />
      </header>

      {/* Profile Card */}
      <section className="influencer-content-inner">
        {/* Main Content */}
        <div className="influencer-content">
          <h1 className="influencer-title">
            {influencerName} is on TeaseMe!
          </h1>
        </div>
        <div className="influencer-profile-card">
          <div className="influencer-avatar-container">
            <div className="influencer-avatar-outer">
              <img
                src={imageProfile}
                alt={influencerName}
                className="influencer-avatar"
              />
            </div>
            <div className="influencer-avatar-glow"></div>
          </div>
          <div className="influencer-profile-info">
            <div className="influencer-name-container">
              <h2 className="influencer-name">{influencerName}</h2>
              <div className="influencer-timer">
                <span className="influencer-timer-text">{timer}</span>
              </div>
            </div>
            <div className="influencer-actions">
              <IconButton leftIcon={<SvgPack.Voice />} color="black" />
              <IconButton leftIcon={<SvgPack.Speaker />} color="black" />
              <IconButton leftIcon={<CallIcon />} color="green" />
            </div>
          </div>
        </div>
        {/* Talk Now Button */}
        <div className="influencer-cta-button-row">

          <div className="influencer-talk-button-container">
            <PrimaryButton
              text="Talk to her now"
              rightIcon={<SvgPack.ArrowRight />}
              onClick={handleTalkNow}
              className="influencer-talk-button"
            />
          </div>
          {/* Features Text */}
          <p className="influencer-features">
            <span>Instant replies</span>
            <span className="influencer-features-dot">•</span>
            <span>24/7</span>
            <span className="influencer-features-dot">•</span>
            <span>Personalised experience</span>
          </p></div>

      </section>




      {/* Discover More Section */}
      <div className="influencer-discover-section">
        <div className="home-page-logo-decoration">
          <img
            src={imageTeaseMeDark}
            alt=""
            className="influencer-page-logo-icon"
          />
        </div>
        <h2 className="influencer-discover-title">
          Want to discover more creators?
        </h2>

        <div className="hp-footer-button-container">

          <PrimaryButton
            text="Search New Influencer"
            rightIcon={<SvgPack.ArrowRight />}
            onClick={() => navigate("/home-page")}
            className="influencer-discover-button"
          />
        </div>
      </div>


    </div>
  );
};

export default InfluencerHome;
