import PrimaryButton from "@/ui/components/inputs/buttons/PrimaryButton";
import TeaseMeLogo from "@/ui/components/logos/TeaseMeLogo";
import SvgPack from "@/utils/SvgPack";
import React, { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import imageProfile from "@/assets/image/imageProfile.jpg";
import imageTeaseMeDark from "@/assets/image/iconTeaseMeDark.png";
import bgWhatYouGet from "@/assets/image/bg-whatyouget.jpg";
import bgWhatYouGet2x from "@/assets/image/bg-whatyouget@2x.jpg";
import iconWhatYouGet01 from "@/assets/image/icon3dchat.png";
import iconWhatYouGet012x from "@/assets/image/icon3dchat@2x.png";
import iconWhatYouGet02 from "@/assets/image/icon3dLightning.png";
import iconWhatYouGet022x from "@/assets/image/icon3dLightning@2x.png";
import iconWhatYouGet03 from "@/assets/image/icon3dLocks.png";
import iconWhatYouGet032x from "@/assets/image/icon3dLock@2x.png";
import CallIcon from "@/assets/Call.svg?react";
import "./HomePage.css";
import IconButton from "@/ui/components/inputs/buttons/IconButton";

const InfluencerHome: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [timer] = useState("00:15");

  // Get influencer name from location state or use default
  const influencerName = (location.state as any)?.influencerName || "[name]";
  const handleTalkNow = () => {
    // TODO: Navigate to call/chat screen
    //console.log("Talk to", influencerName);
  };

  return (
    <div className="influencer-expired">
      {/* Header */}
      <header className="influencer-header">
        <TeaseMeLogo variant="full-dark" size="medium" />
      </header>

      {/* Profile Card */}
      <section className="influencer-content-inner">
        {/* Main Content */}
        <div className="influencer-col01">
          <div className="influencer-profile-card trial-expired">
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
        </div>
        <div className="influencer-col02">
          <h1 className="influencer-title">
            Your trial has finished but {influencerName} is waiting for you.
          </h1>
          {/* Talk Now Button */}
          <div className="influencer-cta-button-row">
            <div className="influencer-talk-button-container">
              <PrimaryButton
                text="Join her TeaseMe"
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
            </p>
          </div>
        </div>
      </section>

      <section className="te-what-you-get-section">
        <div className="te-content-inner">
          {/* what you get card START*/}
          <div className="te-what-you-get-card">
            <div className="te-what-you-get-card-row01">
              <div className="te-icon">
                <img src="" alt="" srcSet={`${iconWhatYouGet01} 1x, ${iconWhatYouGet012x} 2x`} /></div>
              <h2>Personalised Conversations</h2>
            </div>
            <div className="te-what-you-get-card-row02">
              Ask anything — get a response that feels natural, fun, and
              uniquely “them.”
            </div>
          </div>
          {/* what you get card END*/}
             {/* what you get card START*/}
          <div className="te-what-you-get-card">
            <div className="te-what-you-get-card-row01">
              <div className="te-icon">
                <img src="" alt="" srcSet={`${iconWhatYouGet02} 1x, ${iconWhatYouGet022x} 2x`} /></div>
              <h2>Instant Replies, Anytime</h2>
            </div>
            <div className="te-what-you-get-card-row02">
            No waiting. No messages lost. Always available when you want to chat.
            </div>
          </div>
          {/* what you get card END*/}
             {/* what you get card START*/}
          <div className="te-what-you-get-card">
            <div className="te-what-you-get-card-row01">
              <div className="te-icon">
                <img src="" alt="" srcSet={`${iconWhatYouGet03} 1x, ${iconWhatYouGet032x} 2x`} /></div>
              <h2>Safe & Private Chats</h2>
            </div>
            <div className="te-what-you-get-card-row02">
           The creator controls their AI persona — you control your experience.
            </div>
          </div>
          {/* what you get card END*/}
        </div>

        <img
          src={bgWhatYouGet}
          srcSet={`${bgWhatYouGet} 1x, ${bgWhatYouGet2x} 2x`}
          alt=""
          className="te-what-you-get"
        />
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
