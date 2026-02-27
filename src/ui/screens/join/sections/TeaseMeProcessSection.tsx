import React from "react";
import { PROCESS_STEPS } from "../data/processSection";
import "./TeaseMeProcessSection.css";

const TeaseMeProcessSection: React.FC = () => {
  return (
    <section className="tm-process-section">
      <div className="tm-process-container">
        {/* header */}
        <div className="tm-process-header">
          <h2 className="tm-video-title">What is the process?</h2>
          <span className="tm-process-tag">4 Easy Steps</span>
        </div>

        {/* horizontal cards */}
        <div className="tm-process-scroll">
          {PROCESS_STEPS.map((step) => (
            <article key={step.id} className="tm-process-card">
              <div className="tm-process-thumb-wrapper">
                <video
                  src={step.thumb}
                  className="tm-process-thumb"
                  autoPlay
                  muted
                  loop
                  playsInline
                />
              </div>

              <div className="tm-process-body">
                <span className="tm-process-step-label">{step.stepLabel}</span>

                <h3 className="tm-why-card-title">{step.title}</h3>

                <div className="tm-why-card-divider" />

                <p className="tm-why-card-text">{step.description}</p>
              </div>
            </article>
          ))}
          <div className="spacer"></div>
        </div>
      </div>
    </section>
  );
};

export default TeaseMeProcessSection;
