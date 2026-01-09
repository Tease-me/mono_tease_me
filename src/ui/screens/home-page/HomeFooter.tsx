// HomeFooter.tsx
import { Link } from "react-router-dom";

export default function HomeFooter() {
  return (
    <footer className="home-footer">
      <div className="inner-footer">
        <h3 className="footer-title">TeaseMe Terms</h3>

        <Link to="/terms" className="footer-link">
          Terms and Conditions
        </Link>

        <Link to="/privacy" className="footer-link">
          Privacy Policy
        </Link>

        <Link to="/refunds" className="footer-link">
          Refund Policy
        </Link>

        <Link to="/subscriptions" className="footer-link">
          Subscription Policy
        </Link>

        <Link to="/acceptable-use" className="footer-link">
          Acceptable Use Policy
        </Link>

        <Link to="/adult-content" className="footer-link">
          Adult Content Policy
        </Link>

        <Link to="/ai-disclosure" className="footer-link">
          AI Disclosure Policy
        </Link>

        <Link to="/content-moderation" className="footer-link">
          Content Moderation Policy
        </Link>

        <Link to="/data-retention" className="footer-link">
          Data Retention & Deletion Policy
        </Link>

        <Link to="/age-verification" className="footer-link">
          Age Verification Statement
        </Link>

        <Link to="/cookies" className="footer-link">
          Cookie Policy
        </Link>

        <Link to="/prohibited-content" className="footer-link">
          Prohibited Content Appendix
        </Link>
      </div>
    </footer>
  );
}

