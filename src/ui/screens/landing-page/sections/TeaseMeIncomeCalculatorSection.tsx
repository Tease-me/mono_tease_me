import logoTeaseMe from "@/assets/logos/LogoTeaseMe-Light.svg";
import React from "react";
import TeaseMeIncomeCalculator from "./TeaseMeIncomeCalculator";
import "./TeaseMeIncomeCalculatorSection.css";

const TeaseMeIncomeCalculatorSection: React.FC = () => {
  return (
    <section className="tm-income-section">
      <div className="tm-income-card-wrapper">
        <TeaseMeIncomeCalculator />
      </div>

      <div className="tm-income-footer">
        <img src={logoTeaseMe} alt="" />
        <p>© 2026 TeaseMe All Rights Reserved.</p>
        <div className="tm-income-links">
          <button>Privacy Policy</button>
          <button>Contact Us</button>
        </div>
      </div>
    </section>
  );
};

export default TeaseMeIncomeCalculatorSection;
