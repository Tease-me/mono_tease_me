import React from "react";
import { useNavigate } from "react-router-dom";
import "./TermsPage.css";

export type PolicySection = {
  heading: string;
  paragraphs: string[];
  bullets?: string[];
};

type Props = {
  title: string;
  lastUpdated: string;
  intro?: string[];
  sections: PolicySection[];
};

export default function TermsPage({
  title,
  lastUpdated,
  intro = [],
  sections,
}: Props) {
  const navigate = useNavigate();

  return (
    <main className="policy-page">
      <div className="policy-inner">

        {/* Back Button */}
        <button
          className="policy-back-btn"
          onClick={() => navigate(-1)}
        >
          ← Back to Home
        </button>

        <header className="policy-header">
          <h1>{title}</h1>
          <p className="policy-updated">Last updated: {lastUpdated}</p>
        </header>

        {intro.length > 0 && (
          <section className="policy-intro">
            {intro.map((p, i) => (
              <p key={i}>{p}</p>
            ))}
          </section>
        )}

        {sections.map((s, idx) => (
          <section key={idx} className="policy-section">
            <h2>{s.heading}</h2>

            {s.paragraphs.map((p, i) => (
              <p key={i}>{p}</p>
            ))}

            {s.bullets && s.bullets.length > 0 && (
              <ul>
                {s.bullets.map((b, i) => (
                  <li key={i}>{b}</li>
                ))}
              </ul>
            )}
          </section>
        ))}

      </div>
    </main>
  );
}