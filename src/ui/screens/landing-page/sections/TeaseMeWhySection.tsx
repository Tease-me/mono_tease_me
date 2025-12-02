import React from "react";
import "./TeaseMeWhySection.css";


import { WHY_ITEMS } from "../data/whyItems";

const TeaseMeWhySection: React.FC = () => {
  return (
    <section className="tm-why-section">
      <div className="tm-why-container">
        <h2 className="tm-video-title">Why create a TeaseMe persona?</h2>

        <div className="tm-why-scroll">
          {WHY_ITEMS.map((item) => (
            <article key={item.id} className="tm-why-card">
              <div className="tm-why-icon-wrapper">
                <img
                  src={item.thumb}
                  srcSet={`${item.thumb} 1x, ${item.thumb2x} 2x`}
                  alt=""
                  className="tm-why-icon"
                />
              </div>

              <h3 className="tm-why-card-title">{item.title}</h3>

              <div className="tm-why-card-divider" />

              <p className="tm-why-card-text">{item.description}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
};

export default TeaseMeWhySection;
