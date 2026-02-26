import PrimaryButton from "@/ui/components/inputs/buttons/PrimaryButton";

import TeaseMeLogo from "@/ui/components/logos/TeaseMeLogo";
import { Paths } from "@/routes/path";
import SvgPack from "@/utils/SvgPack";
import React, { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import LottieAnimation from "@/ui/components/LottieAnimation";
import imageHPHero from "@/assets/image/creator-collage.jpg";
import heartFloat from "@/assets/lottie/heartFloat.json"
import hpImageRequestBg from "@/assets/image/hpImageRequestBg@2x.jpg"
import imageTeaseMeLight from "@/assets/image/iconTeaseMeLight.png";
import "./LandingPage.css";

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
<section className="intenction-top-section">
      <div className="intenction-col01">
      <div className="intencion-content">
      <div className="hp-inner-container">
        <div className="hp-negative-col01">
        <h1 className="intencion-title">
          We haven't onboarded {influencerName} yet…
        </h1>   <br />
        <p className="intencion-subtitle">
          …but you can help us bring them here!
        </p>   <br />
        <p className="intencion-subtitle">
          Tell us who you want to see —{" "}
          <strong>we'll reach out to them</strong> and
          update you when they join
        </p>
        </div>
      </div>
      </div></div>
<div className="intenction-col02">
      {/* Email Notification Section */}
      <div className="intencion-email-section">
        <h2 className="intencion-email-title">
          Be the first to know when {influencerName} joins
        </h2>
        <div className="intencion-email-input-container">
     <div className="hp-updated-input-container">
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
            </div></div>
          </div>
         <div className="updated-button-container">
          
          <div className="hp-updated-button-container">
          <PrimaryButton
            text="Notify Me & Count My Vote"
            rightIcon={<SvgPack.ArrowRight />}
            onClick={handleNotifyMe}
            disabled={!email.trim()}
            className="intencion-notify-button"
          /></div>
          <p className="intencion-email-disclaimer">
            We'll only email you about this influencer.{" "}
            <strong>No spam.</strong>
          </p></div>
         
        </div>
        </div>

        
      
      </div>
     <img src={imageHPHero} alt="" className="hp-hero-image" />
</section>

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
          the platform.</p>
 
           <p className="intencion-why-text">Your vote helps us show real demand.
        </p>
      </div>
      </div>
      <img className="hp-request-bg" src={hpImageRequestBg} alt="" srcSet={hpImageRequestBg} />
<div className="intencion-invite-lottie-holder"><LottieAnimation autoplay loop animationData={heartFloat} /></div>
</section>
      {/* Invite Link Section */}
      <div className="intencion-invite-section-outer">
 
           <div className="intencion-invite-section-inner">
            <div className="intencion-invite-input-container">
             <div className="invitelink-sendlink-container"> 
                   <div className="home-page-logo-decoration">
          <img
            src={imageTeaseMeLight}
            alt=""
            className="invite-link-logo-icon"
          />
        </div>
              <label className="intencion-invite-label">Send Invite Link</label>
              <div className="intencion-invite-input-wrapper">
                <div className="intencion-invite-input-outer">
                      <input
                      type="text"
                      value={inviteLink}
                      readOnly
                      className="intencion-invite-input-readonly"
                    />
                  
                </div>
              </div></div>
              <PrimaryButton
                text={copied ? "Copied!" : "Copy Invite Link"}
                rightIcon={<SvgPack.ArrowRight />}
                onClick={handleCopyLink}
                className="intencion-copy-button"
              />
            </div>
            
          </div>
        
      </div>

      {/* Discover More Section */}
      <div className="intencion-discover-section">
        <h2 className="intencion-discover-title">
          Want to discover more creators?
        </h2>
        <div className="hp-footer-button-container">
        <PrimaryButton
          text="Search New Influencer"
          rightIcon={<SvgPack.ArrowRight />}
          onClick={() => navigate(Paths.root)}
          className="intencion-discover-button"
        /></div>
      </div>

     
    </div>
  );
};

export default IntencionInfluencerHome;
