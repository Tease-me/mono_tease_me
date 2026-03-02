// HomeFooter.tsx
import { Paths } from "@/routes/path";
import { Link } from "react-router-dom";

export default function HomeFooter() {
  return (
    <footer className="home-footer">
      <div className="inner-footer">
        <h3 className="footer-title">TeaseMe Terms</h3>

        <Link to={Paths.legal.terms} className="footer-link">
          Terms and Conditions
        </Link>

        <Link to={Paths.legal.privacy} className="footer-link">
          Privacy Policy
        </Link>

        <Link to={Paths.legal.refunds} className="footer-link">
          Refund Policy
        </Link>

        <Link to={Paths.legal.subscriptions} className="footer-link">
          Subscription Policy
        </Link>

        <Link to={Paths.legal.acceptableUse} className="footer-link">
          Acceptable Use Policy
        </Link>

        <Link to={Paths.legal.adultContent} className="footer-link">
          Adult Content Policy
        </Link>

        <Link to={Paths.legal.aiDisclosure} className="footer-link">
          AI Disclosure Policy
        </Link>

        <Link to={Paths.legal.contentModeration} className="footer-link">
          Content Moderation Policy
        </Link>

        <Link to={Paths.legal.dataRetention} className="footer-link">
          Data Retention & Deletion Policy
        </Link>

        <Link to={Paths.legal.ageVerification} className="footer-link">
          Age Verification Statement
        </Link>

        <Link to={Paths.legal.cookies} className="footer-link">
          Cookie Policy
        </Link>

        <Link to={Paths.legal.prohibitedContent} className="footer-link">
          Prohibited Content Appendix
        </Link>
      </div>
    </footer>
  );
}
