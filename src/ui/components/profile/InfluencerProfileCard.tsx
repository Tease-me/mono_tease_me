import styles from "./InfluencerProfileCard.module.css";
import SvgPack from "@/utils/SvgPack";
import PlusBadge from "@/ui/components/badges/PlusBadge";

type InfluencerProfileCardProps = {
  name: string;
  image: string;
  lastConnected: string;
  followingSince: string;
  isSubscribed?: boolean;
};

const SOCIAL_ICONS = [
  { icon: SvgPack.OnlyFans, label: "OnlyFans" },
  { icon: SvgPack.Instagram, label: "Instagram" },
  { icon: SvgPack.TikTok, label: "TikTok" },
];

export default function InfluencerProfileCard({
  name,
  image,
  lastConnected,
  followingSince,
  isSubscribed = false,
}: InfluencerProfileCardProps) {
  return (
    <div className={styles.section01}>
      <div className={styles.profileCardContainer}>
        <div className={styles.profileimageContainer}>
          <img src={image} alt={name} className={styles.profileImage} />
          {isSubscribed && (
            <div className={styles.hearticon}>
              <PlusBadge />
            </div>
          )}
        </div>
        <div className={styles.textDetails}>
          {isSubscribed && (
            <div className={styles.textRow01}>
              <h4 className={styles.plusmodeStatus}>
                <span>18+</span> Mode
              </h4>
              <div className={styles.badge}>Subscribed</div>
            </div>
          )}
          <div className={styles.textRow02}>
            <p>
              Last Connected: <span>{lastConnected}</span>
            </p>
            <p>Following Since: {followingSince}</p>
          </div>
        </div>
      </div>
      <div className={styles.profileSociallinks}>
        {SOCIAL_ICONS.map((social, index) => {
          const IconComponent = social.icon;
          return (
            <div key={index} className={styles.socialContainer}>
              <IconComponent />
            </div>
          );
        })}
      </div>
    </div>
  );
}
