import React, { useContext } from "react";
import { useNavigate } from "react-router-dom";
import styles from "./HomeScreenContent.module.css";

import DangerIcon from "@/assets/svg/Danger.svg?react";
import LogoutIcon from "@/assets/svg/Logout.svg?react";
import ProfileIcon from "@/assets/svg/Profile.svg?react";
import TicketIcon from "@/assets/svg/Ticket.svg?react";
import TeaseMeLogo from "@/ui/components/logos/TeaseMeLogo";

import { AuthContext } from "@/context/AuthContext";
import { InfluencerDataModel } from "@/data/models/InfluencerDataModel";
import DropDownMenu, {
  DropDownMenuDataModel,
} from "@/ui/components/inputs/dropdown/DropDownMenu";
import SvgPack from "@/utils/SvgPack";
import ContactTabContent from "./tab-contents/ContactTabContent";

interface HomeScreenContentProps {
  id?: string;
  onItemClick?: (id: string) => void;
}

const HomeScreenContent: React.FC<HomeScreenContentProps> = ({
  id,
  onItemClick,
}) => {
  const { logout } = useContext(AuthContext);
  const navigate = useNavigate();

  const handleOnChatClick = (influencer: InfluencerDataModel) => {
    if (onItemClick) {
      onItemClick(influencer.id);
    } else {
      navigate(`/chat/${influencer.id}`);
    }
  };

  const testDataDropDown: DropDownMenuDataModel[] = [
    {
      id: 1,
      icon: <ProfileIcon />,
      text: "My Profile",
      onClick: () => {
        navigate("/profile");
      },
    },
    {
      id: 2,
      icon: <TicketIcon />,
      text: "Subscriptions",
    },
    {
      id: 3,
      icon: (
        <DangerIcon
          className={styles.menuIcon}
          preserveAspectRatio="xMidYMid meet"
        />
      ),
      text: "Support",
    },
    {
      id: 4,
      icon: <LogoutIcon />,
      text: "Logout",
      styles: {
        style: { color: "var(--color-alert)" },
        hoverStyle: { color: "var(--color-primary)" },
        iconStyle: { color: "var(--color-primary)" },
      },
      onClick: () => {
        logout();
      },
    },
  ];

  return (
    <div className={styles["home-screen-content"]}>
      <header className={styles["home-header"]}>
        <TeaseMeLogo size="medium" variant="full-dark" />
        <DropDownMenu menu={testDataDropDown} className={styles["inbox-icon"]}>
          <SvgPack.MoreCircle />
        </DropDownMenu>
      </header>

      <ContactTabContent
        onChatClicked={handleOnChatClick}
        selectedContactId={id}
      />
    </div>
  );
};

export default HomeScreenContent;
