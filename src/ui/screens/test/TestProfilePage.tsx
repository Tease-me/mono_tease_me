import { useState } from "react";

import SlideDrawerLayout from "@/ui/templates/SlideDrawerLayout";
import ChatScreenContent from "../messaging/components/ChatScreenContent";

import UserMenu from "../user-profile/Components/UserMenu";
import UserProfile from "../user-profile/UserProfile";
import PaymentDetails from "../user-profile/Components/PaymentDetails";
import MyInfluencers from "../user-profile/Components/MyInfluencers";

type SidebarPageId = string;

type SidebarPage = {
  id: SidebarPageId;
  label: string;
  render: (goTo: (id: SidebarPageId) => void) => React.ReactNode;
};


const sidebarPages: SidebarPage[] = [
  {
    id: "home",
    label: "User Menu",
    render: (goTo) => <UserMenu goTo={goTo} />,
  },
    {
    id: "profile",
    label: "User Profile",
    render: (goTo) => <UserProfile goTo={goTo} />,
  },
  {
    id: "payment",
    label: "Payment Details",
    render: (goTo) => <PaymentDetails goTo={goTo} />,
  },
  {
    id: "influencers",
    label: "Influencers",
    render: (goTo) => <MyInfluencers goTo={goTo} />,
  },
];

const TestProfilePage = () => {
  const [showSidebar, setShowSidebar] = useState(false);
  const [currentPage, setCurrentPage] = useState<SidebarPageId>("home");
  const [history, setHistory] = useState<SidebarPageId[]>([]);

  const goTo = (id: SidebarPageId) => {
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
      sidebar={active.render(goTo)}
      onBack={prevPage}
      onToggle={() => setShowSidebar((v) => !v)}
      showBack={currentPage !== 'home'}
      title={active.label}
    >
      <ChatScreenContent
        id="loli"
        onMenuClick={() => setShowSidebar((v) => !v)}
      />
    </SlideDrawerLayout>
  );
};

export default TestProfilePage;
