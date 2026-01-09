import React, { useContext, useEffect, useState } from "react";
import BackgroundGradient from "@/ui/templates/BackgroundGradient";
import { InfluencerDataModel } from "@/data/models/InfluencerDataModel";
import { InfluencerRepo } from "@/data/repositories/InfluencerRepo";
import ChatScreenContent from "../messaging/components/ChatScreenContent";
import InfluencerSelector from "../influencer/InfluencerSelector";
import SvgPack from "@/utils/SvgPack";
import { DropDownMenuDataModel } from "@/ui/components/inputs/dropdown/DropDownMenu";
import { useTheme } from "@/theme/ThemeProvider";
import LogoutIcon from "@/assets/svg/Logout.svg?react";
import ProfileIcon from "@/assets/svg/Profile.svg?react";
import { useNavigate } from "react-router-dom";
import { AuthContext } from "@/context/AuthContext";

export default function HomeScreenSingle() {
  const storedId = localStorage.getItem("selected_id");
  const [id, setId] = useState<string | undefined>(storedId ? storedId : undefined);
  const [needsSelection, setNeedsSelection] = useState(false);
  const [influencers, setInfluencers] = useState<InfluencerDataModel[]>([]);
  const [hasMultipleInfluencers, setHasMultipleInfluencers] = useState(false);

  const { logout } = useContext(AuthContext);

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

  const { theme, setTheme } = useTheme();
  const navigate = useNavigate();


  const testDataDropDown: DropDownMenuDataModel[] = [
    {
      id: 1,
      icon: <ProfileIcon />,
      text: "My Profile",
      onClick: () => {
        navigate("/profile");
      },
    },
    ...(hasMultipleInfluencers ? [{
      id: 2,
      icon: <SvgPack.Female />,
      text: "Change Influencer",
      onClick: () => {
        setNeedsSelection?.(true);
        setId(undefined);
      }
    }] : []),
    {
      id: 3,
      icon: <SvgPack.Heart />,
      text: "Change Theme",
      onClick: () => {
        setTheme(theme === "default" ? "adult" : "default");
      }
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
    <BackgroundGradient>
      {needsSelection && !id ? (
        <InfluencerSelector onItemClick={handleSelect} influencers={influencers} />
      ) : (
        <ChatScreenContent id={id}/>
      )}
    </BackgroundGradient>
  );
}
