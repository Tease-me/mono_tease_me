import { Suspense } from "react";
import SvgPack from "@/utils/SvgPack";
import { SocialLinks } from "./InfluencerProfileCard";
import styles from "./SocialLinksGrid.module.css";

type SocialLink = {
  icon: React.ComponentType;
  label: string;
  url: string;
};

type SocialLinksGridProps = {
  socials?: SocialLinks;
};

export default function SocialLinksGrid({ socials }: SocialLinksGridProps) {
  const socialLinks: SocialLink[] = [
    ...(socials?.onlyfans ? [{ icon: SvgPack.OnlyFans, label: "OnlyFans", url: socials.onlyfans }] : []),
    ...(socials?.instagram ? [{ icon: SvgPack.Instagram, label: "Instagram", url: socials.instagram }] : []),
    ...(socials?.tiktok ? [{ icon: SvgPack.TikTok, label: "TikTok", url: socials.tiktok }] : []),
    ...(socials?.snapchat ? [{ icon: SvgPack.SocialSnapChatWhite, label: "Snapchat", url: socials.snapchat }] : []),
    ...(socials?.telegram ? [{ icon: SvgPack.SocialTelegramWhite, label: "Telegram", url: socials.telegram }] : []),
    ...(socials?.x ? [{ icon: SvgPack.SocialXWhite, label: "X", url: socials.x }] : []),
    ...(socials?.whatsapp ? [{ icon: SvgPack.SocialWhatsAppWhite, label: "WhatsApp", url: socials.whatsapp }] : []),
  ];

  if (socialLinks.length === 0) return null;

  return (
    <div className={styles.grid}>
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
            <Suspense fallback={null}>
              <IconComponent />
            </Suspense>
          </a>
        );
      })}
    </div>
  );
}
