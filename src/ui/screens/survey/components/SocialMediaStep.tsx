import React, { useMemo } from "react";
import styles from "./../ProfileSurvey.module.css";
import SocialSelectorButton from "@/ui/components/inputs/buttons/SocialSelectorButton";

import igWhite from "@/assets/svg/iconSocialInstagramWhite.svg";
import igRed from "@/assets/svg/iconSocialInstagramRed.svg";
import tiktokWhite from "@/assets/svg/iconSocialTiktTokWhite.svg";
import tiktokRed from "@/assets/svg/iconSocialTiktTokRed.svg";
import snapWhite from "@/assets/svg/iconSocialSnapChatWhite.svg";
import snapRed from "@/assets/svg/iconSocialSnapChatRed.svg";
import telegramWhite from "@/assets/svg/iconSocialTelegramWhite.svg";
import telegramRed from "@/assets/svg/iconSocialTelegramRed.svg";
import xWhite from "@/assets/svg/iconSocialXWhite.svg";
import xRed from "@/assets/svg/iconSocialXRed.svg";
import onlyfansWhite from "@/assets/svg/iconSocialOnlyFansWhite.svg";
import onlyfansRed from "@/assets/svg/iconSocialOnlyFansRed.svg";
import whatsappWhite from "@/assets/svg/iconSocialWhatsAppWhite.svg";
import whatsappRed from "@/assets/svg/iconSocialWhatsAppRed.svg";

type SocialId =
  | "instagram"
  | "tiktok"
  | "snapchat"
  | "telegram"
  | "x"
  | "onlyfans"
  | "whatsapp";

interface SocialPlatform {
  id: SocialId;
  label: string;
  icon: string;
  iconError: string;
  activeColor?: "green";
}

interface SocialMediaStepProps {
  answers: Record<string, any>;
  updateAnswer: (key: string, value: any) => void;
  socialError: string | null;
  // Legacy props kept optional for compatibility; unused here
  onVerifyInstagram?: () => void;
  onVerifyTwitter?: () => void;
  instagramVerifying?: boolean;
}

const platforms: SocialPlatform[] = [
  { id: "instagram", label: "Instagram", icon: igWhite, iconError: igRed },
  { id: "tiktok", label: "TikTok", icon: tiktokWhite, iconError: tiktokRed },
  { id: "snapchat", label: "SnapChat", icon: snapWhite, iconError: snapRed },
  { id: "telegram", label: "Telegram", icon: telegramWhite, iconError: telegramRed },
  { id: "x", label: "X", icon: xWhite, iconError: xRed },
  { id: "onlyfans", label: "Only Fans", icon: onlyfansWhite, iconError: onlyfansRed },
  { id: "whatsapp", label: "Whatsapp", icon: whatsappWhite, iconError: whatsappRed },
];

const handleKey = (id: SocialId) => `social_${id}`;
const verifiedKey = (id: SocialId) => `social_${id}_verified`;
const errorKey = (id: SocialId) => `social_${id}_verify_error`;

const SocialMediaStep: React.FC<SocialMediaStepProps> = ({
  answers,
  updateAnswer,
  socialError,
}) => {
  const selectedIds = useMemo<string[]>(
    () => answers["social_selected_platforms"] || [],
    [answers]
  );

  const statusFor = (id: SocialId): "idle" | "selected" | "error" => {
    if (answers[errorKey(id)]) return "error";
    if (answers[verifiedKey(id)]) return "selected";
    if (answers[handleKey(id)] || selectedIds.includes(id)) return "selected";
    return "idle";
  };

  const toggleSelect = (id: SocialId) => {
    const current: string[] = Array.isArray(selectedIds) ? selectedIds : [];
    const next = current.includes(id)
      ? current.filter((item) => item !== id)
      : [...current, id];
    updateAnswer("social_selected_platforms", next);
  };

  return (
    <div className={styles.field}>
      <label className={styles.label}>
        Add your Socials <span className={styles.required}>*</span>
      </label>
      <p className={styles.surveySubtitle}>
        Tap a platform to select it. Modal entry for handles/followers will be added next.
      </p>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: "10px",
          marginTop: "8px",
        }}
      >
        {platforms.map((platform) => (
          <SocialSelectorButton
            key={platform.id}
            label={platform.label}
            icon={platform.icon}
            iconError={platform.iconError}
            state={statusFor(platform.id)}
            activeColor="green"
            onClick={() => toggleSelect(platform.id)}
          />
        ))}
      </div>

      {socialError && <div className={styles.error}>{socialError}</div>}
    </div>
  );
};

export default SocialMediaStep;
