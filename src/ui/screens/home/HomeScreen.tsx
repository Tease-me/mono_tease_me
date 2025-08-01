import React, { useContext, useEffect, useState } from "react";
import BackgroundGradient from "@/ui/templates/BackgroundGradient";
import HomeScreenContent from "./components/HomeScreenContent";
import useMediaQuery from "@/hooks/useMediaQuery";
import TwoPaneLayout from "@/ui/templates/TwoPaneLayout";
import ChatScreenContent from "../messaging/components/ChatScreenContent";
import { AuthContext } from "@/context/AuthContext";
import { useNavigate } from "react-router-dom";
import VerifyEmail from "../verify-email/VerifyEmail";
import Confirmation from "../register/Confirmation";

export default function HomeScreen() {
  const storedId = localStorage.getItem("selected_id");
  const initialId = storedId ? storedId : undefined
  const [id, setId] = useState<string | undefined>(initialId);
  const [showContent, setShowContent] = useState(true);
  const [showSidebar, setShowSidebar] = useState(true);

  const isDesktop = useMediaQuery('(min-width: 1024px)');

  const { user } = useContext(AuthContext);

  useEffect(() => {
    localStorage.setItem("selected_id", id?.toString() || "");
    if (id && !isDesktop) {
      setShowContent(true);
      setShowSidebar(false);
    } else if (!id && !isDesktop) {
      setShowContent(false);
      setShowSidebar(true);
    } else {
      setShowContent(true);
      setShowSidebar(true);
    }
  }, [id, isDesktop]);

  return (
    <BackgroundGradient>
      {user?.is_verified ? <TwoPaneLayout
        showSidebar={showSidebar}
        showContent={showContent}
        sidebar={<HomeScreenContent id={id} onItemClick={(id: string) => { setId(id) }} />}
      >
        <ChatScreenContent id={id} onBackPressed={() => { setId(undefined) }} />
      </TwoPaneLayout> : <Confirmation />}
    </BackgroundGradient>
  );
}
