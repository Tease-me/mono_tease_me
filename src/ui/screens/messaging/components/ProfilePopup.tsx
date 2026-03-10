import React, { Suspense } from "react";
import styles from "./ProfilePopup.module.css";
import FullScreenPopup from "@/ui/components/modals/FullScreenPopup";
import InfluencerProfileCard, { SocialLinks } from "@/ui/components/profile/InfluencerProfileCard";

interface ProfilePopupProps {
  isOpen: boolean;
  onClose: () => void;
  influencerData?: {
    name: string;
    image: string;
    video?: string;
    lastConnected: string;
    followingSince: string;
    isSubscribed?: boolean;
    socials?: SocialLinks;
    bio?: string;
    country?: string;
    languages?: string;
    likes?: string;
    dislikes?: string;
  };
}

export default function ProfilePopup({
  isOpen,
  onClose,
  influencerData,
}: ProfilePopupProps) {
  if (!influencerData) return null;

  return (
    <FullScreenPopup isOpen={isOpen} onClose={onClose} title={influencerData.name}>
      <div className={styles.profileContent}>
        <div className={styles.topRow}>
          <div className={styles.profileCard}>
            <Suspense fallback={null}>
              <InfluencerProfileCard
                name={influencerData.name}
                image={influencerData.image}
                video={influencerData.video}
                lastConnected={influencerData.lastConnected}
                followingSince={influencerData.followingSince}
                isSubscribed={influencerData.isSubscribed}
                socials={influencerData.socials}
              />
            </Suspense>
          </div>

          <div className={styles.aboutMe}>
            <h3 className={styles.detailsHeading}>{influencerData.name}'s Details</h3>
            <div className={styles.section}>
              <span className={styles.label}>About Me</span>
              <p className={styles.value}>{influencerData.bio ?? "--"}</p>
            </div>
          </div>
        </div>

        <div className={styles.details}>
          <div className={styles.divider} />

          <div className={styles.row}>
            <div className={styles.col}>
              <span className={styles.label}>Country</span>
              <span className={styles.value}>{influencerData.country ?? "--"}</span>
            </div>
            <div className={styles.col}>
              <span className={styles.label}>Languages</span>
              <span className={styles.value}>{influencerData.languages ?? "--"}</span>
            </div>
          </div>

          <div className={styles.divider} />

          <div className={styles.section}>
            <span className={styles.label}>Likes</span>
            <p className={styles.value}>{influencerData.likes ?? "--"}</p>
          </div>

          <div className={styles.divider} />

          <div className={styles.section}>
            <span className={styles.label}>Dislikes</span>
            <p className={styles.value}>{influencerData.dislikes ?? "--"}</p>
          </div>
        </div>
      </div>
    </FullScreenPopup>
  );
}
