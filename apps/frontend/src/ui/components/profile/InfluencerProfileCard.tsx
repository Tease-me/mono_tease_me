import styles from "./InfluencerProfileCard.module.css";
import SvgPack from "@/utils/SvgPack";
import PlusBadge from "@/ui/components/badges/PlusBadge";
import ProfileMedia from "@/ui/components/ProfileMedia";
import onlyFansFullImg from "@/assets/image/onlyFansFull.png";

export type SocialLinks = {
  onlyfans?: string;
  instagram?: string;
  tiktok?: string;
  snapchat?: string;
  telegram?: string;
  x?: string;
  whatsapp?: string;
};

type InfluencerProfileCardProps = {
  name: string;
  image: string;
  video?: string;
  followingSince: string;
  isSubscribed?: boolean;
  socials?: SocialLinks;
  onlyFansFullWidth?: boolean;
};

type SocialLink = {
  icon: React.ComponentType;
  label: string;
  url: string;
};

export default function InfluencerProfileCard({
  name,
  image,
  video,
  followingSince,
  isSubscribed = false,
  socials,
  onlyFansFullWidth = false,
}: InfluencerProfileCardProps) {
  const socialLinks: SocialLink[] = [
    ...(socials?.onlyfans && !onlyFansFullWidth ? [{ icon: SvgPack.OnlyFans, label: "OnlyFans", url: socials.onlyfans }] : []),
    ...(socials?.instagram ? [{ icon: SvgPack.Instagram, label: "Instagram", url: socials.instagram }] : []),
    ...(socials?.tiktok ? [{ icon: SvgPack.TikTok, label: "TikTok", url: socials.tiktok }] : []),
    ...(socials?.snapchat ? [{ icon: SvgPack.SocialSnapChatWhite, label: "Snapchat", url: socials.snapchat }] : []),
    ...(socials?.telegram ? [{ icon: SvgPack.SocialTelegramWhite, label: "Telegram", url: socials.telegram }] : []),
    ...(socials?.x ? [{ icon: SvgPack.SocialXWhite, label: "X", url: socials.x }] : []),
    ...(socials?.whatsapp ? [{ icon: SvgPack.SocialWhatsAppWhite, label: "WhatsApp", url: socials.whatsapp }] : []),
  ];
  return (
    <div className={styles.section01}>
      <div className={styles.profileCardContainer}>
        <div className={styles.profileimageContainer}>
          <ProfileMedia imageSrc={image || undefined} videoSrc={video || undefined} size="medium" className={styles.profileMedia} active />
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
            <p className={styles.name}>{name}</p>
            <p>Following Since: {followingSince}</p>
          </div>
        </div>
      </div>
      {onlyFansFullWidth && socials?.onlyfans && (
        <a
          href={socials.onlyfans}
          target="_blank"
          rel="noopener noreferrer"
          className={styles.onlyFansFullRow}
          aria-label="OnlyFans"
        >
          <img src={onlyFansFullImg} alt="OnlyFans" className={styles.onlyFansFullImg} />
        </a>
      )}
      {socialLinks.length > 0 && (
        <div className={styles.profileSociallinks}>
          {socialLinks.map((social, index) => {
            const IconComponent = social.icon;
            return (
              <a
                key={index}
                href={social.url}
                target="_blank"
                rel="noopener noreferrer"
                className={styles.socialContainer}
                aria-label={social.label}
              >
                <IconComponent />
              </a>
            );
          })}
        </div>
      )}
    </div>
  );
}
