import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import BackgroundGradient from "../../components/BackgroundGradient";
import "./Signup.css";

export default function Signup03() {
  const navigate = useNavigate();

  useEffect(() => {
    const timer = setTimeout(() => {
      navigate("/home");
    }, 3000); // 3 segundos pra ir para Home automaticamente

    return () => clearTimeout(timer);
  }, [navigate]);

  return (
    <div className="auth-container">
      <BackgroundGradient />
      <div className="auth-content success-screen">
        <div className="success-icon">🎉</div>
        <h2 className="auth-title">Congratulations!</h2>
        <p>Your account is ready to use. You'll be redirected shortly.</p>
        <div className="loading-spinner"></div>
      </div>
    </div>
  );
}
