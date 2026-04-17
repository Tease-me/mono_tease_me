import React, { useContext, useEffect, useState } from "react";
import BackgroundGradient from "@/ui/templates/BackgroundGradient";
import CenteredLayout from "@/ui/templates/CenteredLayout";
import { useLocation, useNavigate } from "react-router-dom";
import { AuthContext } from "@/context/AuthContext";
import OnBoardingTopNav from "@/ui/components/nav/OnBoardingTopNav";
import { Paths } from "@/routes/path";
import EmailVerificationWaiting from "./components/EmailVerificationWaiting";

interface ConfirmationProps { }

const Confirmation: React.FC<ConfirmationProps> = () => {
  const { isSignedIn } = useContext(AuthContext);
  const { state } = useLocation();
  const [email, setEmail] = useState("");

  const navigate = useNavigate();

  useEffect(() => {
    if (isSignedIn) {
      navigate(Paths.home);
      return;
    }
    const registrationState = state as {
      email?: string;
      influencerId?: string;
    } | null;
    if (!registrationState?.email) {
      navigate(Paths.registerPlain);
      return;
    }
    const { email } = registrationState;
    setEmail(email);
  }, [isSignedIn, state, navigate]);

  if (!email) return null;

  return (
    <BackgroundGradient>
      <OnBoardingTopNav />
      <CenteredLayout>
        <EmailVerificationWaiting email={email} />
      </CenteredLayout>
    </BackgroundGradient>
  );
};

export default Confirmation;
