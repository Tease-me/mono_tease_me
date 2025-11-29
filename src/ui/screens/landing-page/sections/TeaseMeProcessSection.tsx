import React from "react";
import "./TeaseMeProcessSection.css";

import {
  default as step1Thumb,
  default as step2Thumb,
  default as step3Thumb,
  default as step4Thumb,
} from "@/assets/image/process_steps.png";

type ProcessStep = {
  id: number;
  stepLabel: string;
  title: string;
  description: string;
  thumb: string;
};

const PROCESS_STEPS: ProcessStep[] = [
  {
    id: 1,
    stepLabel: "STEP 1",
    title: "Get to know you",
    description:
      "Interview & questionnaire to understand your personality, likes, dislikes, and boundaries — the foundation of your AI persona.",
    thumb: step1Thumb,
  },
  {
    id: 2,
    stepLabel: "STEP 2",
    title: "Design your persona",
    description:
      "We co-create your persona’s voice, style, and fan experience so it feels like you — just amplified and always on.",
    thumb: step2Thumb,
  },
  {
    id: 3,
    stepLabel: "STEP 3",
    title: "Train & test",
    description:
      "Your AI persona is trained, tested, and refined with real conversation flows until it’s ready to meet your fans.",
    thumb: step3Thumb,
  },
  {
    id: 4,
    stepLabel: "STEP 4",
    title: "Launch & scale",
    description:
      "We plug your persona into your socials and funnels, monitor performance, and help you scale the passive income side.",
    thumb: step4Thumb,
  },
];

const TeaseMeProcessSection: React.FC = () => {
  return (
    <section className="tm-process-section">
      <div className="tm-process-container">
        {/* header */}
        <div className="tm-process-header">
          <h2 className="tm-process-title">What is the process?</h2>
          <span className="tm-process-tag">4 Easy Steps</span>
        </div>

        {/* horizontal cards */}
        <div className="tm-process-scroll">
          {PROCESS_STEPS.map((step) => (
            <article key={step.id} className="tm-process-card">
              <div className="tm-process-thumb-wrapper">
                <img
                  src={step.thumb}
                  alt={step.title}
                  className="tm-process-thumb"
                />
              </div>

              <div className="tm-process-body">
                <span className="tm-process-step-label">{step.stepLabel}</span>

                <h3 className="tm-process-card-title">{step.title}</h3>

                <div className="tm-process-divider" />

                <p className="tm-process-card-text">{step.description}</p>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
};

export default TeaseMeProcessSection;
