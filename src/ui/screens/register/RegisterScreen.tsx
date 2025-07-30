import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import BackgroundGradient from "../../templates/BackgroundGradient";
import styles from "./RegisterScreen.module.css";
import CenteredLayout from "@/ui/templates/CenteredLayout";
import { AuthServices } from "@/api/services/AuthServices";
import CheckBox from "@/ui/components/inputs/check-boxes/CheckBox";
import TextInput from "@/ui/components/inputs/text-inputs/TextInput";
import { RegisterResponse } from "@/api/models/auth";

export default function RegisterScreen() {
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(false);
  const [errors, setErrors] = useState<{ username?: string; email?: string; password?: string, general?: string }>({});
  const authServices = AuthServices();

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
      const response: RegisterResponse = await authServices.register(password, email);
      if (response.ok) {
        navigate("/register/verify");
      }
      setErrors({ general: "Registration Failed Plese Try Again Later" });
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
              <TextInput
                type="email"
                placeholder="Email"
                value={email}
                onChange={e => setEmail((e.target as HTMLInputElement).value)} />
              {errors.email && <span className={styles["error"]}>{errors.email}</span>}
              <TextInput
                type="password"
                placeholder="Password"
                value={password}
                onChange={e => setPassword((e.target as HTMLInputElement).value)}
              />
              {errors.password && <span className={styles["error"]}>{errors.password}</span>}

              <CheckBox >
                I am over 18 years old and
              </CheckBox>
              {errors.general && <span className={styles["error"]}>{errors.general}</span>}
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
