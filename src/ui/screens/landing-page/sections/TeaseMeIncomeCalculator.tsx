import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import RotatingPill from "../components/RotatingPill";
import "./TeaseMeIncomeCalculator.css";

const TeaseMeIncomeCalculator: React.FC = () => {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"auto" | "manual">("auto");
  const [period, setPeriod] = useState<"WEEKLY" | "MONTHLY" | "YEARLY">(
    "WEEKLY"
  );
  const [url, setUrl] = useState("");
  const [converted, setConverted] = useState(2);
  const [followers, setFollowers] = useState<number | "">("");

  const otherPhrases = ["income", "freedom", "fans", "travel"];

  const followerCount = typeof followers === "number" ? followers : 0;
  const percentage = converted / 100;

  const MINUTES_PER_DAY = 15;
  const RATE_PER_MINUTE = 0.3;

  const weeklyIncome =
    followerCount * percentage * MINUTES_PER_DAY * 7 * RATE_PER_MINUTE;
  const monthlyIncome =
    followerCount * percentage * MINUTES_PER_DAY * 30 * RATE_PER_MINUTE;
  const yearlyIncome =
    followerCount * percentage * MINUTES_PER_DAY * 365 * RATE_PER_MINUTE;

  const rawIncome =
    period === "WEEKLY"
      ? weeklyIncome
      : period === "MONTHLY"
      ? monthlyIncome
      : yearlyIncome;

  const formattedIncome =
    followerCount > 0
      ? rawIncome.toLocaleString("en-US", {
          style: "currency",
          currency: "USD",
          maximumFractionDigits: 0,
        })
      : "$0";

  return (
    <div className="ic-wrapper">
      <div className="ic-card">
        <h2 className="ic-title">
          Turn influence <br />
          into <RotatingPill phrases={otherPhrases} />
        </h2>

        <div className="ic-question">How much could you earn?</div>

        <div className="ic-toggle">
          <button
            className={`ic-toggle-btn ${mode === "auto" ? "active" : ""}`}
            onClick={() => setMode("auto")}
          >
            Auto
          </button>
          <button
            className={`ic-toggle-btn ${mode === "manual" ? "active" : ""}`}
            onClick={() => setMode("manual")}
          >
            Manual
          </button>
        </div>

        <div className="ic-income-row">
          <div className="ic-income-label">
            INCOME PER
            <select
              className="ic-period"
              value={period}
              onChange={(e) =>
                setPeriod(e.target.value as "WEEKLY" | "MONTHLY" | "YEARLY")
              }
            >
              <option value="WEEKLY">WEEK</option>
              <option value="MONTHLY">MONTH</option>
              <option value="YEARLY">YEAR</option>
            </select>
          </div>
        </div>

        <div className="ic-mode-row">
          <div className="ic-mode-title">
            {mode === "auto" ? "Automode" : "Manual Mode"}
          </div>
          <div className="ic-income-value">{formattedIncome}</div>
        </div>

        <div className="ic-divider" />

        {mode === "manual" && (
          <>
            <label className="ic-label">Total Followers</label>
            <input
              type="number"
              className="ic-input"
              placeholder="Enter number"
              value={followers}
              onChange={(e) =>
                setFollowers(
                  e.target.value === "" ? "" : Number(e.target.value)
                )
              }
            />
          </>
        )}

        <label className="ic-label">
          Social Profile <span className="req">*</span>
        </label>
        <input
          className="ic-input"
          placeholder="Enter URL"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
        />
        <p className="ic-helper">* Requires a public profile</p>

        <label className="ic-label">% converted audience</label>
        <div className="ic-slider">
          <div className="ic-slider-track" />
          <div className="ic-slider-fill" style={{ width: `${converted}%` }} />
          <div className="ic-slider-thumb" style={{ left: `${converted}%` }} />
          <input
            type="range"
            min={0}
            max={100}
            value={converted}
            onChange={(e) => setConverted(Number(e.target.value))}
            className="ic-slider-input"
          />
        </div>

        <button className="ic-cta" onClick={() => navigate("/profile-survey")}>
          Start Building Persona →
        </button>
      </div>
    </div>
  );
};

export default TeaseMeIncomeCalculator;
