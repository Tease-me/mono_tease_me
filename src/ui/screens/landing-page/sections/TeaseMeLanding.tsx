import heroModel from "@/assets/image/hero-woman.png";
import heroModel2x from "@/assets/image/hero-woman@2x.png"


import icon_call from "@/assets/image/icon_call.png";
import logoTeaseMe from "@/assets/logos/LogoTeaseMeDarkMode.svg";
import landingBullets from "@/assets/svg/LandingBullets.svg";
import React from "react";
import { useNavigate } from "react-router-dom";
import RotatingPill from "../components/RotatingPill";
import { BENEFITS } from "../data/benefits";
import "./TeaseMeLanding.css";
import iconInstagram from "@/assets/logos/instagram.svg"
import iconWhatsapp from "@/assets/logos/whatsapp.svg"
import iconTikTok from "@/assets/logos/tiktok.svg"
import iconSnapChat from "@/assets/logos/snapchat.svg"


const TeaseMeLanding: React.FC = () => {
  const navigate = useNavigate();

  const phrases = ["Go travel", "Earn money", "Save time", "Live your life"];

  return (
    <div className="tm-page">
      <div className="tm-device">
        {/* Top logo */}
        <header className="tm-header">
          <img src={logoTeaseMe} alt="Tease Me" className="tm-logo" />
        </header>

        <main className="tm-content">
          <section className="tm-hero">
            {/* LEFT SIDE — TEXT */}
            <div className="tm-hero-text">
              <p className="tm-tagline">
                {/* Reusable rotating pill */}
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

              {/* SOCIALS */}
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

            {/* RIGHT SIDE — MODEL */}
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

          {/* CTA */}
          <div className="tm-bottom-cta">
          <button className="tm-cta" onClick={() => navigate("/welcome")}>
            <span>Try Demo Now</span>
            <img src={icon_call} alt="" className="tm-cta-icon" />
          </button>

          <div className="tm-scroll-hint">
            <span className="tm-scroll-icon">ⓘ</span>
            <p>scroll down to find out more</p>
          </div></div>
        </main>
      </div>
    </div>
  );
};

export default TeaseMeLanding;
