import styles from "./ProfilePopup.module.css";
import FullScreenPopup from "@/ui/components/modals/FullScreenPopup";
import ProfileMedia from "@/ui/components/ProfileMedia";
import SocialLinksGrid from "@/ui/components/profile/SocialLinksGrid";
import { SocialLinks } from "@/ui/components/profile/InfluencerProfileCard";
import { useIsMobile } from "@/hooks/layout/useIsDesktop";

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
  const isMobile = useIsMobile();
  if (!influencerData) return null;

  return (
    <FullScreenPopup isOpen={isOpen} onClose={onClose}>
      <div className={styles.profileContent}>
        <h2 className={styles.title}>{influencerData.name}</h2>
        <div className={styles.topRow}>
          <div className={styles.mediaWrap}>
            <ProfileMedia
              size={isMobile ? "large" : "xlarge"}
              imageSrc={influencerData.image || undefined}
              videoSrc={influencerData.video}
              active
            />
            <SocialLinksGrid socials={influencerData.socials} />
          </div>

          <div className={styles.aboutMe}>
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
              <span className={styles.label}>About Me</span>
              <p className={styles.value}>{influencerData.bio ?? "--"}</p>
            </div>
          </div>
        </div>

        <div className={styles.details}>
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
