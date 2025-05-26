import React from "react";
import { useNavigate } from "react-router-dom";
import BackgroundGradient from "../../components/BackgroundGradient";
import "./Signup.css";

export default function Signup02() {
  const navigate = useNavigate();

  return (
    <div className="auth-container">
      <BackgroundGradient />
      <div className="auth-content">
        <h2 className="auth-title">Fill Your Profile</h2>

        <form className="auth-form">
          <div className="profile-picture-container">
            <div className="profile-picture-placeholder"></div>
            <button className="edit-picture-btn">📷</button>
          </div>

          <div className="gender-selection">
            <button type="button" className="gender-btn active">
              Male ♂️
            </button>
            <button type="button" className="gender-btn">
              Female ♀️
            </button>
          </div>

          <input type="text" placeholder="Name" className="auth-input" />
          <input
            type="date"
            placeholder="Date of Birth"
            className="auth-input"
          />
          <input type="text" placeholder="Nickname" className="auth-input" />

          <div className="auth-buttons">
            <button className="btn-back" onClick={() => navigate("/signup")}>
              Back
            </button>
            <button
              className="btn-primary"
              onClick={() => navigate("/signup/success")}
            >
              Continue
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
