import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import BackgroundGradient from "../../templates/BackgroundGradient";
import styles from "./Signup.module.css";
import CenteredLayout from "@/ui/templates/CenteredLayout";
import { Register } from "@/api/apis";

export default function Signup01() {
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(false);
  const [errors, setErrors] = useState<{ username?: string; email?: string; password?: string }>({});

  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors: { username?: string; email?: string; password?: string } = {};
    if (!username.trim()) newErrors.username = "Username is required";
    if (!email.trim()) newErrors.email = "Email is required";
    if (!password) newErrors.password = "Password is required";
    if (Object.keys(newErrors).length) {
      setErrors(newErrors);
      return;
    }
    try {
      await Register(username, email, password);
      navigate("/signup/profile");
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <BackgroundGradient>
      <CenteredLayout>
        <div className={styles["auth-container"]}>
          <div className={styles["auth-content"]}>
            <h2 className={styles["auth-title"]}>Create your Account</h2>
            <form className={styles["auth-form"]} onSubmit={handleSubmit}>
              <input
                type="text"
                placeholder="Username"
                className={styles["auth-input"]}
                value={username}
                onChange={e => setUsername(e.target.value)}
              />
              {errors.username && <span className={styles["error"]}>{errors.username}</span>}
              <input
                type="email"
                placeholder="Email"
                className={styles["auth-input"]}
                value={email}
                onChange={e => setEmail(e.target.value)}
              />
              {errors.email && <span className={styles["error"]}>{errors.email}</span>}
              <input
                type="password"
                placeholder="Password"
                className={styles["auth-input"]}
                value={password}
                onChange={e => setPassword(e.target.value)}
              />
              {errors.password && <span className={styles["error"]}>{errors.password}</span>}

              <label className={styles["auth-checkbox"]}>
                <input
                  type="checkbox"
                  checked={remember}
                  onChange={e => setRemember(e.target.checked)}
                />
                Remember me
              </label>

              <div className={styles["auth-buttons"]}>
                <button className={styles["btn-back"]} onClick={() => navigate("/")}>
                  Back
                </button>
                <button type="submit" className={styles["btn-primary"]}>
                  Continue
                </button>
              </div>

              <p className={styles["auth-footer"]}>
                Already have an account?{" "}
                <span onClick={() => navigate("/login")}>Sign in</span>
              </p>
            </form>
          </div>
        </div>
      </CenteredLayout>
    </BackgroundGradient>
  );
}
