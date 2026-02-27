import logoTeaseMe from "@/assets/logos/LogoTeaseMe-Light.svg";
import { Paths } from "@/routes/path";
import React from "react";
import { Link } from "react-router-dom";
import TeaseMeIncomeCalculator from "./TeaseMeIncomeCalculator";
import "./TeaseMeIncomeCalculatorSection.css";

const TeaseMeIncomeCalculatorSection: React.FC = () => {
  return (
    <section className="tm-income-section">
      <div className="tm-income-card-wrapper">
        <TeaseMeIncomeCalculator />
      </div>

      <div className="tm-income-footer">
        <div className="footer-content-container">
          <div className="tm-income-links">
            <Link to={Paths.legal.terms}>Terms and Conditions</Link>
            <Link to={Paths.legal.privacy}>Privacy Policy</Link>
            <Link to={Paths.legal.refunds}>Refund Policy</Link>
            <Link to={Paths.legal.subscriptions}>Subscription Policy</Link>
            <Link to={Paths.legal.acceptableUse}>Acceptable Use Policy</Link>
            <Link to={Paths.legal.adultContent}>Adult Content Policy</Link>
            <Link to={Paths.legal.aiDisclosure}>AI Disclosure Policy</Link>
            <Link to={Paths.legal.contentModeration}>
              Content Moderation Policy
            </Link>
            <Link to={Paths.legal.dataRetention}>
              Data Retention & Deletion Policy
            </Link>
            <Link to={Paths.legal.ageVerification}>Age Verification Statement</Link>
            <Link to={Paths.legal.cookies}>Cookie Policy</Link>
            <Link to={Paths.legal.prohibitedContent}>
              Prohibited Content Appendix
            </Link>
          </div>
          <img src={logoTeaseMe} alt="" />
          <p>© 2026 TeaseMe All Rights Reserved.</p>
        </div>
      </div>
    </section>
  );
};

export default TeaseMeIncomeCalculatorSection;
