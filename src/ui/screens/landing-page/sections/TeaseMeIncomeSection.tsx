import PrimaryButton from "@/ui/components/inputs/buttons/PrimaryButton";
import SvgPack from "@/utils/SvgPack";
import React from "react";
import "./TeaseMeIncomeSection.css";

import incomeIcon from "@/assets/svg/Calc.svg";

const TeaseMeIncomeSection: React.FC = () => {
  return (
    <section className="tm-income-section">
      <div className="tm-income-cta-card-wrapper">
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
            Want to know how much passive{" "}
            <strong>income you could earn?</strong>
          </p>

          {/* Divider */}
          <div className="tm-income-divider"></div>

          {/* Button */}
          <div className="tm-income-button-container">
            <PrimaryButton
              onClick={() => {
                document.getElementById("ic-anchor")?.scrollIntoView({
                  behavior: "smooth",
                });
              }}
              text="Calculate Income"
              rightIcon={<SvgPack.ArrowDown />}
            />
          </div>
        </div>
      </div>
    </section>
  );
};

export default TeaseMeIncomeSection;
