import styles from "./InfluencerProfileCard.module.css";
import SvgPack from "@/utils/SvgPack";
import PlusBadge from "@/ui/components/badges/PlusBadge";

type InfluencerProfileCardProps = {
  name: string;
  image: string;
  lastConnected: string;
  followingSince: string;
  isSubscribed?: boolean;
  onlyFansUrl?: string;
  instagramUrl?: string;
  tiktokUrl?: string;
  snapchatUrl?: string;
  telegramUrl?: string;
  xUrl?: string;
  whatsappUrl?: string;
};

type SocialLink = {
  icon: React.ComponentType;
  label: string;
  url: string;
};

export default function InfluencerProfileCard({
  name,
  image,
  lastConnected,
  followingSince,
  isSubscribed = false,
  onlyFansUrl,
  instagramUrl,
  tiktokUrl,
  snapchatUrl,
  telegramUrl,
  xUrl,
  whatsappUrl,
}: InfluencerProfileCardProps) {
  const socialLinks: SocialLink[] = [
    ...(onlyFansUrl ? [{ icon: SvgPack.OnlyFans, label: "OnlyFans", url: onlyFansUrl }] : []),
    ...(instagramUrl ? [{ icon: SvgPack.Instagram, label: "Instagram", url: instagramUrl }] : []),
    ...(tiktokUrl ? [{ icon: SvgPack.TikTok, label: "TikTok", url: tiktokUrl }] : []),
    ...(snapchatUrl ? [{ icon: SvgPack.SocialSnapChatWhite, label: "Snapchat", url: snapchatUrl }] : []),
    ...(telegramUrl ? [{ icon: SvgPack.SocialTelegramWhite, label: "Telegram", url: telegramUrl }] : []),
    ...(xUrl ? [{ icon: SvgPack.SocialXWhite, label: "X", url: xUrl }] : []),
    ...(whatsappUrl ? [{ icon: SvgPack.SocialWhatsAppWhite, label: "WhatsApp", url: whatsappUrl }] : []),
  ];
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
