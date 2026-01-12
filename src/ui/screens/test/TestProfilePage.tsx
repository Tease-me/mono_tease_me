import { useState } from "react";

import SlideDrawerLayout from "@/ui/templates/SlideDrawerLayout";
import ChatScreenContent from "../messaging/components/ChatScreenContent";

import UserMenu from "../user-profile/UserMenu";
import UserProfile from "../user-profile/Components/UserProfile";
import PaymentDetails from "../user-profile/Components/PaymentDetails";
import ManageInfluencers from "../user-profile/Components/ManageInfluencers";
import InfluencerRelation from "../user-profile/Components/InfluencerRelation";

type SidebarPageId = string;
type NavPayload = Record<string, any>;

type SidebarPage = {
  id: SidebarPageId;
  label: string;
  render: (ctx: { goTo: (id: SidebarPageId, payload?: NavPayload) => void; navPayload: NavPayload; goBack: () => void }) => React.ReactNode;
};

const sidebarPages: SidebarPage[] = [
  { id: "home", label: "User Menu", render: ({ goTo }) => <UserMenu goTo={goTo} /> },
  { id: "profile", label: "User Profile", render: ({ goTo }) => <UserProfile goTo={goTo} /> },
  { id: "payment", label: "Payment Details", render: ({ goTo }) => <PaymentDetails goTo={goTo} /> },
  { id: "influencers", label: "Influencers", render: ({ goTo, navPayload, goBack }) => <ManageInfluencers goTo={goTo} navPayload={navPayload} goBack={goBack} /> },
  { id: "influencer_profile", label: "Influencer Profile", render: ({ goTo, navPayload, goBack }) => <InfluencerRelation goTo={goTo} navPayload={navPayload} goBack={goBack} /> },
];

const TestProfilePage = () => {
  const [showSidebar, setShowSidebar] = useState(false);
  const [currentPage, setCurrentPage] = useState<SidebarPageId>("home");
  const [history, setHistory] = useState<SidebarPageId[]>([]);
  const [navPayload, setNavPayload] = useState<NavPayload>({});

  const goTo = (id: SidebarPageId, payload?: NavPayload) => {
    if (payload) setNavPayload((p) => ({ ...p, ...payload }));
    setHistory((h) => [...h, currentPage]);
    setCurrentPage(id);
  };

  const prevPage = () => {
    setHistory((h) => {
      const prev = h[h.length - 1] ?? "home";
      setCurrentPage(prev);
      return h.slice(0, -1);
    });
  };

  const active = sidebarPages.find((p) => p.id === currentPage)!;

  return (
    <SlideDrawerLayout
      showSidebar={showSidebar}
      sidebar={active.render({ goTo, navPayload, goBack: prevPage })}
      onBack={prevPage}
      onToggle={() => setShowSidebar((v) => !v)}
      showBack={currentPage !== "home"}
      title={active.label}
    >
      <ChatScreenContent id="anna"
       onMenuClick={() => setShowSidebar((v) => !v)}  />
    </SlideDrawerLayout>
  );
};

export default TestProfilePage;
