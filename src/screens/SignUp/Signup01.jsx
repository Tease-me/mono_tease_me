import React from "react";
import { useNavigate } from "react-router-dom";
import BackgroundGradient from "../../components/BackgroundGradient";
import "./Signup.css";

export default function Signup01() {
  const navigate = useNavigate();

  return (
    <div className="auth-container">
      <BackgroundGradient />
      <div className="auth-content">
        <h2 className="auth-title">Create your Account</h2>
        <form className="auth-form">
          <input type="email" placeholder="Email" className="auth-input" />
          <input
            type="password"
            placeholder="Password"
            className="auth-input"
          />

          <label className="auth-checkbox">
            <input type="checkbox" /> Remember me
          </label>

          <div className="auth-buttons">
            <button className="btn-back" onClick={() => navigate("/")}>
              Back
            </button>
            <button
              className="btn-primary"
              onClick={() => navigate("/signup/profile")}
            >
              Continue
            </button>
          </div>

          <p className="auth-footer">
            Already have an account?{" "}
            <span onClick={() => navigate("/login")}>Sign in</span>
          </p>
        </form>
      </div>
    </div>
  );
}
