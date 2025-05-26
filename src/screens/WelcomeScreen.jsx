// screens/WelcomeScreen.jsx
import React from "react";
import { useNavigate } from "react-router-dom";
import oliviaImage from "../assets/image/avatar.png";
import BackgroundGradient from "../components/BackgroundGradient";
import "./WelcomeScreen.css";

export default function WelcomeScreen({ isVideo, name }) {
  const navigate = useNavigate();

  return (
    <div className="welcome-screen">
      <BackgroundGradient />

      <div className="content">
        <div className="profile-container">
          {isVideo ? (
            <video autoPlay loop muted className="profile-media">
              <source src={oliviaImage} type="video/mp4" />
              Your browser doesn't support video.
            </video>
          ) : (
            <img
              src={oliviaImage}
              alt={`Profile of ${name}`}
              className="profile-media"
            />
          )}
          <div className="hearts-overlay">
            <span className="heart">❤️</span>
            <span className="heart">❤️</span>
            <span className="heart">❤️</span>
          </div>
        </div>

        <h2 className="join-text">Join {name} on</h2>
        <h1 className="brand">
          Tease<span>Me</span>
        </h1>

        <p className="signup-text">
          Don't have an account?{" "}
          <span
            className="signup-link"
            onClick={() => navigate("/signup")}
            style={{ cursor: "pointer", color: "#ff4d6d" }}
          >
            Sign up
          </span>
        </p>

        <div className="divider">
          <span>or</span>
        </div>

        <button className="email-button" onClick={() => navigate("/login")}>
          Sign in with email
        </button>
      </div>
    </div>
  );
}
