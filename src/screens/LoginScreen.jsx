import React from "react";
import { useNavigate } from "react-router-dom";
import "./LoginScreen.css";

export default function LoginScreen() {
  const navigate = useNavigate();

  return (
    <div className="auth-container">
      <div className="auth-content">
        <h2 className="auth-title">Login to your Account</h2>

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

          <button
            className="btn-primary"
            onClick={() => navigate("/home")}
            style={{ marginTop: "15px" }}
          >
            Sign In
          </button>

          <p className="auth-footer">
            <span>Forgot your password?</span>
          </p>
        </form>
      </div>
    </div>
  );
}
