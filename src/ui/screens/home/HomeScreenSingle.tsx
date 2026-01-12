import React, { useEffect, useState } from "react";
import { InfluencerDataModel } from "@/data/models/InfluencerDataModel";
import { InfluencerRepo } from "@/data/repositories/InfluencerRepo";
import ChatScreenContent from "../messaging/components/ChatScreenContent";
import InfluencerSelector from "../influencer/InfluencerSelector";
import UserMenu from "../user-profile/UserMenu";
import UserProfile from "../user-profile/OLDUserProfile";
import PaymentDetails from "../user-profile/Components/PaymentDetails";
import ManageInfluencers from "../user-profile/Components/ManageInfluencers";
import InfluencerRelation from "../user-profile/Components/InfluencerRelation";
import SlideDrawerLayout from "@/ui/templates/SlideDrawerLayout";

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

export default function HomeScreenSingle() {
  const storedId = localStorage.getItem("selected_id");
  const [id, setId] = useState<string | undefined>(storedId ? storedId : undefined);
  const [needsSelection, setNeedsSelection] = useState(false);
  const [influencers, setInfluencers] = useState<InfluencerDataModel[]>([]);
  const [hasMultipleInfluencers, setHasMultipleInfluencers] = useState(false);
  const [showSidebar, setShowSidebar] = useState(false);
  const [currentPage, setCurrentPage] = useState<SidebarPageId>("home");
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
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
  useEffect(() => {
    localStorage.setItem("selected_id", id?.toString() || "");
  }, [id]);
  useEffect(() => {
    const influencerRepo = InfluencerRepo();
    influencerRepo
      .getFollowedInfluencers()
      .then((influencers: InfluencerDataModel[]) => {
        if (influencers.length > 1) {
          setNeedsSelection(true);
          setHasMultipleInfluencers(true);
        } else if (influencers.length === 1) {
          setId(influencers[0].id);
          setHasMultipleInfluencers(false);
        }
        setInfluencers(influencers);
      });
  }, []);

  const handleSelect = (selectedId: string) => {
    setId(selectedId);
    setNeedsSelection(false);
  };

  const handleNeedsSelection = () => {
    setId(undefined);
    setNeedsSelection(true);
  }

  return (
    <SlideDrawerLayout
      showSidebar={showSidebar}
      sidebar={active.render({ goTo, navPayload, goBack: prevPage })}
      onBack={prevPage}
      onToggle={() => setShowSidebar((v) => !v)}
      showBack={currentPage !== "home"}
      title={active.label}
    >
      {needsSelection ? (
        !id ? <InfluencerSelector onItemClick={handleSelect} influencers={influencers} /> : <ChatScreenContent id={id} onMenuClick={() => setShowSidebar((v) => !v)} setNeedsSelection={handleNeedsSelection} showChangeInfluencerButton={hasMultipleInfluencers} />
      ) : (
        <ChatScreenContent id={id} onMenuClick={() => setShowSidebar((v) => !v)} setNeedsSelection={setNeedsSelection} showChangeInfluencerButton={hasMultipleInfluencers} />
      )}
    </SlideDrawerLayout>
  );
}
