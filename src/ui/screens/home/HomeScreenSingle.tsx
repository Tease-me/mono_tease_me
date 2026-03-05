import React, {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { SidebarContext } from "@/hooks/useSidebar";
import { useLocation } from "react-router-dom";
import ChatScreenContent from "../messaging/components/ChatScreenContent";
import SlideDrawerLayout from "@/ui/templates/SlideDrawerLayout";
import clsx from "clsx";
import styles from "./HomeScreenSingle.module.css";
import LoadingSpinner from "@/ui/components/loading/LoadingSpinner";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { startInfluencerSubscription } from "@/store/subscriptionSlice";
import { ADULT_MODE_AVAILABLE } from "@/constants/adultModeAvailable";
import { storage } from "@/utils/storage";
import { LocalStorageKeys } from "@/constants/localStorageKeys";

const UserMenu = React.lazy(() => import("../user-profile/UserMenu"));
const UserProfile = React.lazy(
  () => import("../user-profile/Components/UserProfile"),
);
const PaymentDetails = React.lazy(
  () => import("../user-profile/Components/PaymentDetails"),
);
const ManageInfluencers = React.lazy(
  () => import("../user-profile/Components/ManageInfluencers"),
);
const InfluencerRelation = React.lazy(
  () => import("../user-profile/Components/InfluencerRelation"),
);
const AddCredits = React.lazy(
  () => import("../user-profile/Components/AddCredits"),
);
const AdultModePage = React.lazy(
  () => import("../messaging/pages/adult-mode/AdultModePage"),
);
const AdultModeComingSoon = React.lazy(
  () => import("../messaging/pages/adult-mode/AdultModeComingSoon"),
);
const PaymentCheck = React.lazy(
  () => import("../user-profile/Components/PaymentCheck"),
);
const Subscription = React.lazy(
  () => import("../user-profile/Components/Subscription"),
);

type SidebarPageId = string;
type NavPayload = Record<string, any>;
type NavStackEntry = { id: SidebarPageId; payload?: NavPayload };

type SidebarPage = {
  id: SidebarPageId;
  label: string;
  render: (ctx: {
    goTo: (id: SidebarPageId, payload?: NavPayload) => void;
    navPayload: NavPayload;
    goBack: () => void;
  }) => React.ReactNode;
  background?: string;
};

export default function HomeScreenSingle() {
  const dispatch = useAppDispatch();
  const { isSubscribing } = useAppSelector((state) => state.subscription);
  const currentInfluencerId = useAppSelector(
    (state) => state.chatScreen.currentInfluencerId,
  );
  const influencerById = useAppSelector(
    (state) => state.chatScreen.influencerById,
  );
  const currentInfluencerName = currentInfluencerId
    ? influencerById[currentInfluencerId]?.name
    : undefined;
  const [openSubscribeInfluencerId, setOpenSubscribeInfluencerId] = useState<
    string | undefined
  >();
  const [showSidebar, setShowSidebar] = useState(false);
  const [currentPage, setCurrentPage] = useState<SidebarPageId>("home");

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [history, setHistory] = useState<NavStackEntry[]>([]);
  const [navPayload, setNavPayload] = useState<NavPayload>({});
  const currentPageRef = useRef<SidebarPageId>("home");
  const navPayloadRef = useRef<NavPayload>({});

  const location = useLocation();
  const [openSubscribe, setOpenSubscribe] = useState(false);

  useEffect(() => {
    currentPageRef.current = currentPage;
  }, [currentPage]);

  useEffect(() => {
    navPayloadRef.current = navPayload;
  }, [navPayload]);

  useEffect(() => {
    if (currentPageRef.current !== "influencer_profile") return;
    if (!currentInfluencerId) return;
    if (navPayloadRef.current?.influencerId === currentInfluencerId) return;
    setNavPayload((p) => ({
      ...p,
      influencerId: currentInfluencerId,
      name: influencerById[currentInfluencerId]?.name,
      image: influencerById[currentInfluencerId]?.img,
      video: influencerById[currentInfluencerId]?.videoUrl,
    }));
  }, [currentInfluencerId, influencerById]);

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

  const handleSidebarSubscribe = useCallback(
    async (influencerId?: string, goBack?: () => void) => {
      if (!influencerId || isSubscribing) {
        return;
      }
      const result = await dispatch(
        startInfluencerSubscription({
          influencerId,
          planId: 1,
        }),
      );
      window.alert(result.message);
      goBack?.();
    },
    [dispatch, isSubscribing],
  );

  const sidebarPages: SidebarPage[] = useMemo(() => ([
    { id: "home", label: "User Menu", render: ({ goTo }) => <UserMenu goTo={goTo} /> },
    { id: "profile", label: "User Profile", render: ({ goTo }) => <UserProfile goTo={goTo} /> },
    { id: "payment", label: "Payment Details", render: ({ goTo }) => <PaymentDetails goTo={goTo} /> },
    { id: "payment-check", label: "Payment", render: () => <PaymentCheck />, background: "#181A20" },
    {
      id: "influencers",
      label: "Topup",
      render: ({ goTo, navPayload }) =>
        <ManageInfluencers
          goTo={goTo}
          navPayload={navPayload}
        />
    },
    { id: "influencer_profile", label: "Influencer Profile", background: "#080808", render: ({ goTo, navPayload, goBack }) => <InfluencerRelation key={navPayload.influencerId} goTo={goTo} navPayload={navPayload} goBack={goBack} /> },
    { id: "add_credits", label: "Add Credits", render: ({ goTo, navPayload }) => <AddCredits goTo={goTo} navpayload={navPayload} /> },
    {
      id: "subscribe", label: "Adult Mode", render: ({ navPayload, goBack }) => (
        ADULT_MODE_AVAILABLE ? (
          <AdultModePage
            influencerId={navPayload.influencerId}
            influencerImageUrl={navPayload.influencerImageUrl}
            influencerName={navPayload.influencerName}
            onSubscribePressed={() => handleSidebarSubscribe(navPayload.influencerId, goBack)}
            onBackClicked={goBack}
            nobg
          />
        ) : (
          <AdultModeComingSoon onBackClicked={goBack} nobg />
        )
      )
    },
    { id: "subscription", label: "Subscription", render: ({ goTo, navPayload }) => <Subscription goTo={goTo} navPayload={navPayload} />, background: "linear-gradient(0deg, #131313 0%, #131313 100%), url(<path-to-image>) lightgray -60.714px 0px / 130.206% 89.736% no-repeat" },
  ]), [handleSidebarSubscribe]);


  const active = useMemo(
    () => sidebarPages.find((p) => p.id === currentPage)!,
    [currentPage, sidebarPages],
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

  const openSidebar = useCallback(
    (pageId: string, payload?: Record<string, any>) => {
      setShowSidebar(true);
      goTo(pageId, payload);
    },
    [goTo],
  );

  const sidebar = (
    <div className={styles.sidebarPages}>
      <div className={clsx(styles.sidebarPage, styles.sidebarPageActive)}>
        <Suspense
          fallback={
            <div className={styles.loadingSpinner}>
              <LoadingSpinner />
            </div>
          }
        >
          {active.render({ goTo, navPayload, goBack: prevPage })}
        </Suspense>
      </div>
    </div>
  );

  useEffect(() => {
    if (!location.state?.openSubscribe) return;
    const raw = storage.get(LocalStorageKeys.AdultVerificationTarget);
    if (!raw) return;
    try {
      const target = JSON.parse(raw);
      storage.remove(LocalStorageKeys.AdultVerificationTarget);
      if (target.influencerId) {
        setOpenSubscribeInfluencerId(target.influencerId);
        setOpenSubscribe(true);
      }
    } catch {
      // invalid JSON, ignore
    }
    window.history.replaceState({}, "");
  }, [location.state]);

  const chatContent = useMemo(
    () => (
      <ChatScreenContent
        defaultInfluencerId={openSubscribeInfluencerId}
        onMenuClick={toggleSidebar}
        openSubscribe={openSubscribe}
      />
    ),
    [openSubscribeInfluencerId, toggleSidebar, openSubscribe],
  );

  return (
    <SidebarContext.Provider value={{ openSidebar }}>
      <SlideDrawerLayout
        showSidebar={showSidebar}
        sidebar={sidebar}
        onBack={prevPage}
        onToggle={toggleSidebar}
        showBack={currentPage !== "home"}
        title={
          currentPage === "influencer_profile"
            ? currentInfluencerName || navPayload?.name
              ? `Top Up - ${currentInfluencerName ?? navPayload?.name}`
              : "Top Up"
            : active.label
        }
        background={active.background}
      >
        {chatContent}
      </SlideDrawerLayout>
    </SidebarContext.Provider>
  );
}
