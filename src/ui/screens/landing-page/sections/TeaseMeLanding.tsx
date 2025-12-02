import heroModel from "@/assets/image/hero_model.png";
import icon_call from "@/assets/image/icon_call.png";
import socialMedias from "@/assets/image/social_medias.png";
import logoTeaseMe from "@/assets/logos/LogoTeaseMeDarkMode.svg";
import landingBullets from "@/assets/svg/LandingBullets.svg";
import React from "react";
import { useNavigate } from "react-router-dom";
import RotatingPill from "../components/RotatingPill";
import { BENEFITS } from "../data/benefits";
import "./TeaseMeLanding.css";

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

                <span> and</span>
                <br />
                <span>let your persona</span>
                <br />
                <span>work for you.</span>
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
                <img
                  src={socialMedias}
                  alt="Social media icons"
                  className="tm-integrations-img"
                />
              </div>
            </div>

            {/* RIGHT SIDE — MODEL */}
            <div className="tm-hero-image-wrapper">
              <div className="tm-hero-glow" />
              <img src={heroModel} alt="" className="tm-hero-image" />
            </div>
          </section>

          {/* CTA */}
          <button className="tm-cta" onClick={() => navigate("/welcome")}>
            <span>Try Demo Now</span>
            <img src={icon_call} alt="" className="tm-cta-icon" />
          </button>

          <p className="tm-scroll-hint">
            <span className="tm-scroll-icon">ⓘ</span>
            <span>scroll down to find out more</span>
          </p>
        </main>
      </div>
    </div>
  );
};

export default TeaseMeLanding;
