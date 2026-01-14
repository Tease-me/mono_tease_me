import React, { useCallback, useEffect, useMemo, useState } from "react";
import { InfluencerDataModel } from "@/data/models/InfluencerDataModel";
import { InfluencerRepo } from "@/data/repositories/InfluencerRepo";
import ChatScreenContent from "../messaging/components/ChatScreenContent";
import InfluencerSelector from "../influencer/InfluencerSelector";
import UserMenu from "../user-profile/UserMenu";
import UserProfile from "../user-profile/Components/UserProfile";
import PaymentDetails from "../user-profile/Components/PaymentDetails";
import ManageInfluencers from "../user-profile/Components/ManageInfluencers";
import InfluencerRelation from "../user-profile/Components/InfluencerRelation";
import AddCredits from "../user-profile/Components/AddCredits";
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
  { id: "add_credits", label: "Add Credits", render: ({ goTo, navPayload}) => <AddCredits goTo={goTo} navpayload={navPayload}  /> },
];

export default function HomeScreenSingle() {
  const [id, setId] = useState<string | undefined>(() => {
    const storedId = localStorage.getItem("selected_id");
    return storedId ? storedId : undefined;
  });
  const [needsSelection, setNeedsSelection] = useState(false);
  const [influencers, setInfluencers] = useState<InfluencerDataModel[]>([]);
  const [hasMultipleInfluencers, setHasMultipleInfluencers] = useState(false);
  const [showSidebar, setShowSidebar] = useState(false);
  const [currentPage, setCurrentPage] = useState<SidebarPageId>("home");
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [history, setHistory] = useState<SidebarPageId[]>([]);
  const [navPayload, setNavPayload] = useState<NavPayload>({});

  const influencerRepo = useMemo(() => InfluencerRepo(), []);

  const goTo = useCallback((pageId: SidebarPageId, payload?: NavPayload) => {
    if (payload) setNavPayload((p) => ({ ...p, ...payload }));
    setHistory((h) => [...h, currentPage]);
    setCurrentPage(pageId);
  }, [currentPage]);

  const prevPage = useCallback(() => {
    setHistory((h) => {
      const prev = h[h.length - 1] ?? "home";
      setCurrentPage(prev);
      return h.slice(0, -1);
    });
  }, []);

  const active = useMemo(
    () => sidebarPages.find((p) => p.id === currentPage)!,
    [currentPage]
  );

  const toggleSidebar = useCallback(() => {
    setShowSidebar((v) => !v);
  }, []);

  const sidebar = useMemo(
    () => active.render({ goTo, navPayload, goBack: prevPage }),
    [active, goTo, navPayload, prevPage]
  );

  useEffect(() => {
    localStorage.setItem("selected_id", id?.toString() || "");
  }, [id]);
  useEffect(() => {
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
  }, [influencerRepo]);

  const handleSelect = useCallback((selectedId: string) => {
    setId(selectedId);
    setNeedsSelection(false);
  }, []);

  const handleNeedsSelectionChange = useCallback((needs: boolean) => {
    if (needs) {
      setId(undefined);
    }
    setNeedsSelection(needs);
  }, []);

  const chatContent = useMemo(
    () => (
      <ChatScreenContent
        id={id}
        onMenuClick={toggleSidebar}
        setNeedsSelection={handleNeedsSelectionChange}
        showChangeInfluencerButton={hasMultipleInfluencers}
      />
    ),
    [handleNeedsSelectionChange, hasMultipleInfluencers, id, toggleSidebar]
  );

  return (
    <SlideDrawerLayout
      showSidebar={showSidebar}
      sidebar={sidebar}
      onBack={prevPage}
      onToggle={toggleSidebar}
      showBack={currentPage !== "home"}
      title={
  currentPage === "influencer_profile" && navPayload?.name
    ? navPayload.name
    : active.label
}
    >
      {needsSelection ? (
        !id ? <InfluencerSelector onItemClick={handleSelect} influencers={influencers} /> : chatContent
      ) : (
        chatContent
      )}
    </SlideDrawerLayout>
  );
}
