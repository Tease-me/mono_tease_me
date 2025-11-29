import heroModel from "@/assets/image/hero_model.png";
import socialMedias from "@/assets/image/social_medias.png";
import logoTeaseMe from "@/assets/logos/LogoTeaseMeDarkMode.svg";
import landingBullets from "@/assets/svg/LandingBullets.svg";
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import "./TeaseMeLanding.css";

const TeaseMeLanding: React.FC = () => {
  const navigate = useNavigate();
  const phrases = ["Go travel", "Earn money", "Save time", "Live your life"];

  const [currentIndex, setCurrentIndex] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);
  const nextIndex = (currentIndex + 1) % phrases.length;

  // Wait ~2.4s, then trigger animation
  useEffect(() => {
    const id = setTimeout(() => setIsAnimating(true), 1800);
    return () => clearTimeout(id);
  }, [currentIndex]);

  // After animation (~0.35s), switch to next text
  useEffect(() => {
    if (!isAnimating) return;
    const id = setTimeout(() => {
      setCurrentIndex((prev) => (prev + 1) % phrases.length);
      setIsAnimating(false);
    }, 350);
    return () => clearTimeout(id);
  }, [isAnimating]);

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
                {/* PILL + “and” on same line */}
                <span className="tm-tagline-pill">
                  <span className="tm-pill-layer">
                    {/* CURRENT TEXT */}
                    <span
                      className={`tm-pill-text tm-pill-current ${
                        isAnimating ? "tm-pill-out" : ""
                      }`}
                    >
                      {phrases[currentIndex]}
                    </span>

                    {/* NEXT TEXT */}
                    {isAnimating && (
                      <span className="tm-pill-text tm-pill-next tm-pill-in">
                        {phrases[nextIndex]}
                      </span>
                    )}
                  </span>
                </span>

                <span> and</span>
                <br />
                <span>let your persona</span>
                <br />
                <span>work for you.</span>
              </p>

              {/* BENEFITS */}
              <ul className="tm-benefits">
                <li className="tm-benefit-pill">
                  <img
                    src={landingBullets}
                    alt=""
                    className="tm-benefit-icon"
                  />
                  <span>Earn money while sleeping</span>
                </li>
                <li className="tm-benefit-pill">
                  <img
                    src={landingBullets}
                    alt=""
                    className="tm-benefit-icon"
                  />
                  <span>Competitive advantage</span>
                </li>
                <li className="tm-benefit-pill">
                  <img
                    src={landingBullets}
                    alt=""
                    className="tm-benefit-icon"
                  />
                  <span>Your personal touch</span>
                </li>
                <li className="tm-benefit-pill">
                  <img
                    src={landingBullets}
                    alt=""
                    className="tm-benefit-icon"
                  />
                  <span>Global fan reach</span>
                </li>
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
          <button className="tm-cta" onClick={() => navigate("/")}>
            <span>Try Demo Now</span>
            <span className="tm-cta-icon">📞</span>
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
