import PrimaryButton from "@/ui/components/inputs/buttons/PrimaryButton";
import TeaseMeLogo from "@/ui/components/logos/TeaseMeLogo";
import SvgPack from "@/utils/SvgPack";
import React, { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import "./InfluencerHome.css";

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

      {/* Main Content */}
      <div className="influencer-content">
        <h1 className="influencer-title">
          {influencerName} is <br /> on TeaseMe!
        </h1>
      </div>

      {/* Profile Card */}
      <div className="influencer-profile-card">
        <div className="influencer-avatar-container">
          <div className="influencer-avatar-outer">
            <img
              src={influencerAvatar}
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
            <button className="influencer-action-btn influencer-action-btn-volume">
              <div className="influencer-action-icon">
                <img
                  src="http://localhost:3845/assets/4eab24fc23941f1b33958146927a0122dd36df5b.svg"
                  alt="Volume"
                />
              </div>
            </button>
            <button className="influencer-action-btn influencer-action-btn-voice">
              <div className="influencer-action-icon">
                <img
                  src="http://localhost:3845/assets/327a8da48b8964969d0458eca08e97ae91bfda3e.svg"
                  alt="Voice"
                />
              </div>
            </button>
            <button className="influencer-action-btn influencer-action-btn-call">
              <div className="influencer-action-icon">
                <img
                  src="http://localhost:3845/assets/ccdb5f0beaf9c0d4bd39082d1233e211744cb2ec.svg"
                  alt="Call"
                />
              </div>
            </button>
          </div>
        </div>
      </div>

      {/* Features Text */}
      <p className="influencer-features">
        <span>Instant replies</span>
        <span className="influencer-features-dot">•</span>
        <span>24/7</span>
        <span className="influencer-features-dot">•</span>
        <span>Personalised experience</span>
      </p>

      {/* Talk Now Button */}
      <div className="influencer-talk-button-container">
        <PrimaryButton
          text="Talk to her now"
          rightIcon={<SvgPack.ArrowRight />}
          onClick={handleTalkNow}
          className="influencer-talk-button"
        />
      </div>

      {/* Discover More Section */}
      <div className="influencer-discover-section">
        <h2 className="influencer-discover-title">
          Want to discover more creators?
        </h2>
        <PrimaryButton
          text="Search New Influencer"
          rightIcon={<SvgPack.ArrowRight />}
          onClick={() => navigate("/home-page")}
          className="influencer-discover-button"
        />
      </div>

      {/* Decorative Logo */}
      <div className="influencer-logo-decoration">
        <img
          src="http://localhost:3845/assets/7b67cb56f0cd8b0b85e718cd6c94a32032ca9683.png"
          alt=""
          className="influencer-logo-icon"
        />
      </div>
    </div>
  );
};

export default InfluencerHome;
