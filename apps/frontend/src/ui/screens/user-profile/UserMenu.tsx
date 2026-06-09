import React, { useContext, useEffect, useState } from "react";
import NavigationRow from "@/ui/components/inputs/buttons/NavigationRow";
import styles from "./UserMenu.module.css";
import FadingDivider from "@/ui/components/dividers/FadingDivider";
import SvgPack from "@/utils/SvgPack";
import { AuthContext } from "@/context/AuthContext";
import clsx from "clsx";
import { LocalStorageKeys } from "@/constants/localStorageKeys";
import { storage } from "@/utils/storage";
import InfluencerProfileCard, { SocialLinks } from "@/ui/components/profile/InfluencerProfileCard";
import { InfluencerRepo } from "@/data/repositories/InfluencerRepo";
import { FollowServices } from "@/api/services/FollowServices";
import { apiClient } from "@/api/apis";
import { InfluencerServices } from "@/api/services/InfluencerService";
import AppVersionBadge from "@/ui/components/app-version/AppVersionBadge";

type UserMenuProps = {
  goTo: (id: string, payload?: any) => void;
  onSwitchInfluencer?: () => void;
};

type SidebarInfluencer = {
  name: string;
  image: string;
  video?: string;
  followingSince: string;
  socials?: SocialLinks;
};

const influencerRepo = InfluencerRepo();
const followService = FollowServices(apiClient);
const influencerService = InfluencerServices(apiClient);

function formatFollowingSince(date?: string): string {
  if (!date || Number.isNaN(Date.parse(date))) return "--";
  return new Date(date).toLocaleDateString();
}

export default function UserMenu({ goTo, onSwitchInfluencer }: UserMenuProps) {
  const storedId = storage.get(LocalStorageKeys.SelectedId);
  const { logout } = useContext(AuthContext);
  const [selectedInfluencer, setSelectedInfluencer] = useState<SidebarInfluencer | null>(null);

  useEffect(() => {
    if (!storedId) {
      setSelectedInfluencer(null);
      return;
    }

    let cancelled = false;

    (async () => {
      const [influencerResult, followResult, bioResult] = await Promise.allSettled([
        influencerRepo.getInfluencer(storedId),
        followService.list(),
        influencerService.getBio(storedId),
      ]);

      if (cancelled || influencerResult.status !== "fulfilled") return;

      const followingSince =
        followResult.status === "fulfilled"
          ? followResult.value.items.find((item) => item.influencer_id === storedId)?.created_at
          : undefined;
      const socials =
        bioResult.status === "fulfilled" && bioResult.value.social_links?.length
          ? (Object.fromEntries(
              bioResult.value.social_links.map((social) => [social.platform, social.url]),
            ) as SocialLinks)
          : undefined;

      setSelectedInfluencer({
        name: influencerResult.value.name,
        image: influencerResult.value.img,
        video: influencerResult.value.videoUrl,
        followingSince: formatFollowingSince(followingSince),
        socials,
      });
    })();

    return () => {
      cancelled = true;
    };
  }, [storedId]);

  const handleUserProfileClick = () => {
    goTo("profile");
  };

  // const handlePaymentDetailsClick = () => {
  //   goTo("payment");
  // };

  const handlePTopupClick = () => {
    if (!storedId) return;
    goTo("influencer_profile", {
      influencerId: storedId,
    });
  };

  // const handleManageInfluencersClick = () => {
  //   goTo("influencers")
  // }
  return (
    <div className="u-sidebar-page">
      <div className={clsx(styles.container)}>
        <div className={styles.header}></div>
        {selectedInfluencer && (
          <div className={styles.profileCardArea}>
            <InfluencerProfileCard
              name={selectedInfluencer.name}
              image={selectedInfluencer.image}
              video={selectedInfluencer.video}
              followingSince={selectedInfluencer.followingSince}
              socials={selectedInfluencer.socials}
              onlyFansFullWidth
            />
          </div>
        )}
        <div className={styles.menuArea}>
          <NavigationRow
            title="User Profile"
            subtitle="Edit & Update User Details"
            onClick={handleUserProfileClick}
          />
          {/* <NavigationRow
            title="Payment Details"
            subtitle="Add & Edit Payment Sources"
            onClick={handlePaymentDetailsClick}
          /> */}
          {storedId && (
            <NavigationRow
              title="Topup"
              subtitle="Topup your account"
              onClick={handlePTopupClick}
            />
          )}
          {onSwitchInfluencer && (
            <NavigationRow
              title="Switch Influencer"
              subtitle="Choose another influencer"
              onClick={onSwitchInfluencer}
            />
          )}
          {/* <NavigationRow title="Manage Influencer" subtitle='Fund, Manage & View Your Influencers' onClick={handleManageInfluencersClick} /> */}
        </div>
      </div>
      <div className="u-sidebar-footer">
        <div className={"u-sidebar-footer"}>
          <FadingDivider />
          <button className={styles.logoutButton} onClick={() => logout()}>
            <SvgPack.Logout />
            Logout
          </button>
          <div className={styles.versionContainer}>
            <AppVersionBadge />
          </div>
        </div>
      </div>
    </div>
  );
}
