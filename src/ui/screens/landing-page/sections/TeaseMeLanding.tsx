import heroModel from "@/assets/image/hero-woman.png";
import heroModel2x from "@/assets/image/hero-woman@2x.png"
import landingBullets from "@/assets/svg/LandingBullets.svg";
import React, { useEffect, useState } from "react";
import RotatingPill from "../components/RotatingPill";
import { BENEFITS } from "../data/benefits";
import "./TeaseMeLanding.css";
import iconInstagram from "@/assets/logos/instagram.svg"
import iconWhatsapp from "@/assets/logos/whatsapp.svg"
import iconTikTok from "@/assets/logos/tiktok.svg"
import iconSnapChat from "@/assets/logos/snapchat.svg"
import PrimaryButton from "@/ui/components/inputs/buttons/PrimaryButton"
import SvgPack from "@/utils/SvgPack";
import WelcomeCallModal from "@/ui/components/modals/welcome-call/WelcomeCallModal";
import dummy from "@/dummy/dummy";
import { InfluencerDataModel } from "@/data/models/InfluencerDataModel";
import useCallLanding from "@/hooks/useCallLanding";
import { LocalStorageKeys } from "@/constants/localStorageKeys";
import { storage } from "@/utils/storage";
import { useNavigate } from "react-router-dom";
import TeaseMeLogo from "@/ui/components/logos/TeaseMeLogo";


const TeaseMeLanding: React.FC = () => {
  const [openModal, setOpenModal] = React.useState(false);
  const { startConversation, status, stopConversation, timeRemaining } = useCallLanding();

  const phrases = ["Go travel", "Earn money", "Save time", "Live your life"];
  const [hasConnected, setHasConnected] = useState(false);
  const navigate = useNavigate();

  const demoInfluencer: InfluencerDataModel = {
    id: "landing-loli",
    username: "loli",
    name: "Loli",
    img: dummy.getImage("loli"),
    videoUrl: dummy.getVideo("loli"),
    bio: "",
    created_at: "2024-01-01T00:00:00Z",
    earnings: 0,
    isSelected: false,
  };

  const handleTryDemoCall = () => {
    setOpenModal(true);
    startConversation();
  };

  useEffect(() => {
    if (status === "connected") {
      storage.setBoolean(LocalStorageKeys.VisitedWelcome, true);
      setHasConnected(true);
    }

    if (status === "disconnected" && hasConnected) {
      navigate("/income-dialog");
    }
  }, [status, hasConnected, navigate]);

  return (
    <div className="tm-page">
      <div className="tm-device">
        <header className="tm-header">
          <TeaseMeLogo variant="full-dark" />
        </header>
        <main className="tm-content">
          <section className="tm-hero">
            <div className="tm-hero-text">
              <p className="tm-tagline">
                <RotatingPill phrases={phrases} />
                <span> and let your persona work for you.</span>
              </p>

              <ul className="tm-benefits">
                {BENEFITS.map((item) => (
                  <li key={item.id} className="tm-benefit-pill">
                    <img
                      src={landingBullets}
                      alt=""
                      className="tm-benefit-icon"
                    />
                    <span>{item.text}</span>
                  </li>
                ))}
              </ul>

              <div className="tm-integrations">
                <p>Integrates your</p>
                <div className="tm-icons-row">
                  <div className="tm-integrates-icon"><img src={iconInstagram} alt="" /></div>
                  <div className="tm-integrates-icon"><img src={iconTikTok} alt="" /></div>
                  <div className="tm-integrates-icon"><img src={iconSnapChat} alt="" /></div>
                  <div className="tm-integrates-icon"><img src={iconWhatsapp} alt="" /></div>
                </div>
              </div>
            </div>

            <div className="tm-hero-image-wrapper">
              <div className="tm-hero-glow" />
              <img
                src={heroModel}
                srcSet={`${heroModel} 1x, ${heroModel2x} 2x`}
                alt=""
                className="tm-hero-image"
              />
            </div>
          </section>

          <div className="tm-bottom-cta">
            <div className="tm-cta-button-container">
              <PrimaryButton onClick={handleTryDemoCall} text="Try Demo Now" rightIcon={<SvgPack.Call />} />
            </div>
            <div className="tm-scroll-hint">
              <span className="tm-scroll-icon">ⓘ</span>
              <p>scroll down to find out more</p>
            </div></div>
        </main>
      </div>

      <WelcomeCallModal initalSecondsLeft={timeRemaining || 120} influencer={demoInfluencer} isOpen={openModal} onClose={() => {

      }} status={status} stopConversation={function (): void {
        stopConversation();
        setOpenModal(false);
      }} />
    </div>
  );
};

export default TeaseMeLanding;
