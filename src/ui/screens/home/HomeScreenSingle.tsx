import React, { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { InfluencerDataModel } from "@/data/models/InfluencerDataModel";
import { InfluencerRepo } from "@/data/repositories/InfluencerRepo";
import ChatScreenContent from "../messaging/components/ChatScreenContent";
import InfluencerSelector from "../influencer/InfluencerSelector";
import SlideDrawerLayout from "@/ui/templates/SlideDrawerLayout";
import clsx from "clsx";
import styles from "./HomeScreenSingle.module.css"
import LoadingSpinner from "@/ui/components/loading/LoadingSpinner";

const UserMenu = React.lazy(() => import("../user-profile/UserMenu"));
const UserProfile = React.lazy(() => import("../user-profile/Components/UserProfile"));
const PaymentDetails = React.lazy(() => import("../user-profile/Components/PaymentDetails"));
const ManageInfluencers = React.lazy(() => import("../user-profile/Components/ManageInfluencers"));
const InfluencerRelation = React.lazy(() => import("../user-profile/Components/InfluencerRelation"));
const AddCredits = React.lazy(() => import("../user-profile/Components/AddCredits"));
const AdultModePage = React.lazy(() => import("../messaging/pages/adult-mode/AdultModePage"));
const PaymentCheck = React.lazy(() => import("../user-profile/Components/PaymentCheck"));
const Subscription = React.lazy(() => import("../user-profile/Components/Subscription"));

type SidebarPageId = string;
type NavPayload = Record<string, any>;
type NavStackEntry = { id: SidebarPageId; payload?: NavPayload };

type SidebarPage = {
  id: SidebarPageId;
  label: string;
  render: (ctx: { goTo: (id: SidebarPageId, payload?: NavPayload) => void; navPayload: NavPayload; goBack: () => void }) => React.ReactNode;
  background?: string;
};

const sidebarPages: SidebarPage[] = [
  { id: "home", label: "User Menu", render: ({ goTo }) => <UserMenu goTo={goTo} /> },
  { id: "profile", label: "User Profile", render: ({ goTo }) => <UserProfile goTo={goTo} /> },
  { id: "payment", label: "Payment Details", render: ({ goTo }) => <PaymentDetails goTo={goTo} /> },
  { id: "payment-check", label: "Payment", render: () => <PaymentCheck />, background: "#181A20" },
  {
    id: "influencers",
    label: "Manage Influencers",
    render: ({ goTo, navPayload }) =>
      <ManageInfluencers
        goTo={goTo}
        navPayload={navPayload}
      />
  },
  { id: "influencer_profile", label: "Influencer Profile", render: ({ goTo, navPayload, goBack }) => <InfluencerRelation goTo={goTo} navPayload={navPayload} goBack={goBack} /> },
  { id: "add_credits", label: "Add Credits", render: ({ goTo, navPayload }) => <AddCredits goTo={goTo} navpayload={navPayload} /> },
  {
    id: "subscribe", label: "Subscribe", render: ({ navPayload }) => (
      <AdultModePage
        influencerId={navPayload.influencerId}
        influencerImageUrl={navPayload.image}
        onSubscribePressed={() => {
          navPayload.onSubscribe();
        }}
        nobg
      />
    )
  },
  { id: "subscription", label: "Subscription", render: ({ goTo, navPayload }) => <Subscription goTo={goTo} navPayload={navPayload} />, background: "linear-gradient(0deg, #131313 0%, #131313 100%), url(<path-to-image>) lightgray -60.714px 0px / 130.206% 89.736% no-repeat" },

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
  const [history, setHistory] = useState<NavStackEntry[]>([]);
  const [navPayload, setNavPayload] = useState<NavPayload>({});
  const currentPageRef = useRef<SidebarPageId>("home");
  const navPayloadRef = useRef<NavPayload>({});

  const influencerRepo = useMemo(() => InfluencerRepo(), []);

  useEffect(() => {
    currentPageRef.current = currentPage;
  }, [currentPage]);

  useEffect(() => {
    navPayloadRef.current = navPayload;
  }, [navPayload]);

  const goTo = useCallback((pageId: SidebarPageId, payload?: NavPayload) => {
    if (payload) {
      setNavPayload((p) => ({ ...p, ...payload }));
    }
    setHistory((h) => [
      ...h,
      { id: currentPageRef.current, payload: navPayloadRef.current },
    ]);
    setCurrentPage(pageId);
  }, []);

  const prevPage = useCallback(() => {
    setHistory((h) => {
      const prev = h[h.length - 1];
      if (prev) {
        setCurrentPage(prev.id);
        setNavPayload(prev.payload ?? {});
      } else {
        setCurrentPage("home");
        setNavPayload({});
      }
      return h.slice(0, -1);
    });
  }, []);


  const active = useMemo(
    () => sidebarPages.find((p) => p.id === currentPage)!,
    [currentPage]
  );

  const toggleSidebar = useCallback(() => {
    setShowSidebar((prev) => {
      const next = !prev;
      if (!next) {
        setCurrentPage("home");
        setHistory([]);
        setNavPayload({});
      }
      return next;
    });
  }, []);

  const sidebar = (
    <div className={styles.sidebarPages}>
      <div className={clsx(styles.sidebarPage, styles.sidebarPageActive)}>
        <Suspense fallback={<div className={styles.loadingSpinner}><LoadingSpinner /></div>}>
          {active.render({ goTo, navPayload, goBack: prevPage })}
        </Suspense>
      </div>
    </div>
  );


  useEffect(() => {
    localStorage.setItem("selected_id", id?.toString() || "");
  }, [id]);

  useEffect(() => {
    influencerRepo
      .getFollowedInfluencers()
      .then((influencers: InfluencerDataModel[]) => {
        localStorage.setItem("selected_id", "");
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
      background={active.background}
    >
      {needsSelection ? (
        !id ? <InfluencerSelector onItemClick={handleSelect} influencers={influencers} /> : chatContent
      ) : (
        chatContent
      )}
    </SlideDrawerLayout>
  );
}
