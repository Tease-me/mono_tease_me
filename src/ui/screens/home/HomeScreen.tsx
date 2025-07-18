import React, { useEffect, useState } from "react";
import BackgroundGradient from "@/ui/templates/BackgroundGradient";
import FullWidthLayout from "@/ui/templates/FullWidthLayout";
import HomeScreenContent from "./components/HomeScreenContent";
import useMediaQuery from "@/hooks/useMediaQuery";
import TwoPaneLayout from "@/ui/templates/TwoPaneLayout";
import ChatScreenContent from "../messaging/components/ChatScreenContent";

export default function HomeScreen() {
  const [id, setId] = useState<number>();
  const [showContent, setShowContent] = useState(true);
  const [showSidebar, setShowSidebar] = useState(true);

  const isDesktop = useMediaQuery('(min-width: 1024px)');

  useEffect(() => {
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
      <TwoPaneLayout
        showSidebar={showSidebar}
        showContent={showContent}
        sidebar={<HomeScreenContent onItemClick={(id: number) => { setId(id) }} />}
      >
        <ChatScreenContent id={id} onBackPressed={() => { setId(undefined) }} />
      </TwoPaneLayout>
    </BackgroundGradient>
  );
}
