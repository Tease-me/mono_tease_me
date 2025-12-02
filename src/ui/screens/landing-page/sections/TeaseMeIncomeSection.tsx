import React from "react";
import "./TeaseMeIncomeSection.css";

import incomeIcon from "@/assets/image/calculator.png";

const TeaseMeIncomeSection: React.FC = () => {
  return (
    <section className="tm-income-section">
      <div className="tm-income-card">
        {/* Icon */}
        <div className="tm-income-icon-wrapper">
          <img
            src={incomeIcon}
            alt="Income Calculator"
            className="tm-income-icon"
          />
        </div>

        {/* Title */}
        <p className="tm-income-title">
          Want to know how much passive <strong>income you could earn?</strong>
        </p>

        {/* Divider */}
        <div className="tm-income-divider"></div>

        {/* Button */}
        <button className="tm-income-button">
          Calculate Income <span className="tm-income-arrow">↓</span>
        </button>
      </div>
    </section>
  );
};

export default TeaseMeIncomeSection;
