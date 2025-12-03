import React, { useEffect, useState } from "react";
import BackgroundGradient from "@/ui/templates/BackgroundGradient";
// import HomeScreenContent from "./components/HomeScreenContent";
// import useMediaQuery from "@/hooks/useMediaQuery";
import { InfluencerDataModel } from "@/data/models/InfluencerDataModel";
import { InfluencerRepo } from "@/data/repositories/InfluencerRepo";
// import TwoPaneLayout from "@/ui/templates/TwoPaneLayout";
import ChatScreenContent from "../messaging/components/ChatScreenContent";
// import WelcomeCallModal from "@/ui/components/modals/welcome-call/WelcomeCallModal";
// import { AuthContext } from "@/context/AuthContext";

export default function HomeScreenSingle() {
  const [id, setId] = useState<string | undefined>(undefined);
  useEffect(() => {
    const influencerRepo = InfluencerRepo();
    influencerRepo.getInfluencers().then((influencers: InfluencerDataModel[]) => {
      influencers.length > 0 && setId(influencers[0].id)
    })
  }, [])
  // const [id, setId] = useState<string | undefined>(initialId);
  // const [showContent, setShowContent] = useState(true);
  // const [showSidebar, setShowSidebar] = useState(true);
  // const [isOpen, setIsOpen] = useState(false);

  // const { user } = useContext(AuthContext);

  // const isDesktop = useMediaQuery('(min-width: 1024px)');
  // useEffect(() => {
  //   setIsOpen(user?.first_time_login ?? false)
  // }, [user])
  // useEffect(() => {
  //   localStorage.setItem("selected_id", id?.toString() || "");
  //   if (id && !isDesktop) {
  //     setShowContent(true);
  //     // setShowSidebar(false);
  //   } else if (!id && !isDesktop) {
  //     setShowContent(false);
  //     // setShowSidebar(true);
  //   } else {
  //     setShowContent(true);
  //     // setShowSidebar(true);
  //   }
  // }, [id, isDesktop]);

  return (
    <BackgroundGradient>
      <ChatScreenContent id={id} />
      {/* <WelcomeCallModal isOpen={isOpen} onClose={() => { setIsOpen(false) }} /> */}
    </BackgroundGradient>
  );
}
