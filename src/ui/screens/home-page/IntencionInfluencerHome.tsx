import PrimaryButton from "@/ui/components/inputs/buttons/PrimaryButton";

import TeaseMeLogo from "@/ui/components/logos/TeaseMeLogo";
import SvgPack from "@/utils/SvgPack";
import React, { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import hpImageRequestBg from "@/assets/image/hpImageRequestBg@2x.jpg"
import "./HomePage.css";

const IntencionInfluencerHome: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState("");
  const [voteCount] = useState(1003);
  const [copied, setCopied] = useState(false);

  // Get influencer name from location state or use default
  const influencerName = (location.state as any)?.influencerName || "[Name]";
  const inviteLink = "teaseme.live/join";

  const handleCopyLink = () => {
    navigator.clipboard.writeText(inviteLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleNotifyMe = () => {
    // TODO: Implement email notification API call
    //console.log("Notify me:", email);
  };

  return (
    <div className="intencion-influencer-home">
  
   

      {/* Header */}
      <header className="intencion-header">
        <TeaseMeLogo variant="full-dark" size="medium" />
      </header>

      {/* Main Content */}
      <div className="intencion-content">
        <h1 className="intencion-title">
          We haven't onboarded {influencerName} yet…
        </h1>
        <p className="intencion-subtitle">
          …but you can help us bring them here!
        </p>
        <p className="intencion-subtitle">
          Tell us who you want to see —{" "}
          <strong>we'll reach out to them</strong> and
          update you when they join.
        </p>
      </div>

      {/* Email Notification Section */}
      <div className="intencion-email-section">
        <h2 className="intencion-email-title">
          Be the first to know when {influencerName} joins
        </h2>
        <div className="intencion-email-input-container">
     <label className="ps-label">
              Email <span className="ps-required"></span>
            </label>
          <div className="intencion-email-input-wrapper">
            <div className="intencion-email-input-outer">
              <div className="intencion-email-input-inner">
                                <div className="home-page-input-outer"><input
              className="ps-input"
              type="email"
             placeholder="Enter your email"
              value={email}
                  onChange={(e) =>
                    setEmail((e.target as HTMLInputElement).value)}
            /></div>
              </div>
            </div>
          </div>
          <PrimaryButton
            text="Notify Me & Count My Vote"
            rightIcon={<SvgPack.ArrowRight />}
            onClick={handleNotifyMe}
            disabled={!email.trim()}
            className="intencion-notify-button"
          />
          <p className="intencion-email-disclaimer">
            We'll only email you about this influencer.{" "}
            <strong>No spam.</strong>
          </p>
        </div>

        
        <div className="intencion-logo-decoration">
          <img
            src="http://localhost:3845/assets/a010421442b76263c51653d93d332d39364f4f0c.png"
            alt=""
            className="intencion-logo-icon"
          />
        </div>
      </div>

      {/* Vote Counter Card */}
<section className="why-it-matters">
   <div className="hp-inner-container">
      <div className="intencion-vote-card">
        <div className="intencion-vote-number">
          {String(voteCount)
            .split("")
            .map((digit, index) => (
              <span key={index} className="intencion-vote-digit">
                {digit}
              </span>
            ))}
        </div>
        <p className="intencion-vote-text">Fans have requested this creator.</p>
      </div>

      {/* Why It Matters Section */}
      <div className="intencion-why-section">
        
        <h2 className="intencion-why-title">Why It Matters…</h2>
        <p className="intencion-why-text">
          The more fans request this creator, the more likely they are to join
          the platform.
          <br />
          Your vote helps us show real demand.
        </p>
      </div>
      </div>
      <img className="hp-request-bg" src={hpImageRequestBg} alt="" srcset={hpImageRequestBg} />

</section>
      {/* Invite Link Section */}
      <div className="intencion-invite-section">
 
           <div className="hp-inner-container">
            <div className="intencion-invite-input-container">
              <label className="intencion-invite-label">Send Invite Link</label>
              <div className="intencion-invite-input-wrapper">
                <div className="intencion-invite-input-outer">
                  <div className="intencion-invite-input-inner">
                    <input
                      type="text"
                      value={inviteLink}
                      readOnly
                      className="intencion-invite-input-readonly"
                    />
                  </div>
                </div>
              </div>
              <PrimaryButton
                text={copied ? "Copied!" : "Copy Invite Link"}
                rightIcon={<SvgPack.ArrowRight />}
                onClick={handleCopyLink}
                className="intencion-copy-button"
              />
            </div>
            <div className="intencion-invite-logo">
              <img
                src="http://localhost:3845/assets/a010421442b76263c51653d93d332d39364f4f0c.png"
                alt=""
                className="intencion-invite-logo-icon"
              />
            </div>
          </div>
        
      </div>

      {/* Discover More Section */}
      <div className="intencion-discover-section">
        <h2 className="intencion-discover-title">
          Want to discover more creators?
        </h2>
        <PrimaryButton
          text="Search New Influencer"
          rightIcon={<SvgPack.ArrowRight />}
          onClick={() => navigate("/home-page")}
          className="intencion-discover-button"
        />
      </div>

      {/* Hearts Feedback */}
      <div className="intencion-hearts-feedback">
        <img
          src="http://localhost:3845/assets/b0ac715c08a220ed65cec6407bd02c6db0ed1f38.png"
          alt=""
          className="intencion-hearts-feedback-image"
        />
      </div>
    </div>
  );
};

export default IntencionInfluencerHome;
