import React, { useMemo, useState } from "react";
import { Modal } from "@/ui/components/modals/Modal";
import SocialSelectorButton from "@/ui/components/inputs/buttons/SocialSelectorButton";
import styles from "./SocialMediaStep.module.css"
import PrimaryButton from "@/ui/components/inputs/buttons/PrimaryButton";
import TextInput from "@/ui/components/inputs/text-inputs/TextInput";
import ValidationPill from "@/ui/components/inputs/buttons/ValidationPill";

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
}

interface SocialMediaStepProps {
  answers: Record<string, any>;
  updateAnswer: (key: string, value: any) => void;
  socialError: string | null;
  onVerifyInstagram?: () => Promise<void> | void;
  onVerifyTwitter?: () => Promise<void> | void;
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
const followerKey = (id: SocialId) => `social_${id}_followers`;
const verifiedKey = (id: SocialId) => `social_${id}_verified`;
const errorKey = (id: SocialId) => `social_${id}_verify_error`;

const SocialMediaStep: React.FC<SocialMediaStepProps> = ({
  answers,
  updateAnswer,
  socialError,
  onVerifyInstagram,
  onVerifyTwitter,
  instagramVerifying,
}) => {
  const [openId, setOpenId] = useState<SocialId | null>(null);
  const [localHandle, setLocalHandle] = useState("");
  const [localFollowers, setLocalFollowers] = useState("");

  const selected = useMemo<string[]>(
    () => (Array.isArray(answers["social_selected_platforms"]) ? answers["social_selected_platforms"] : []),
    [answers]
  );

  const stateFor = (id: SocialId): "idle" | "selected" | "error" => {
    if (answers[errorKey(id)]) return "error";
    if (answers[verifiedKey(id)]) return "selected";
    if (answers[handleKey(id)]) return "selected";
    if (selected.includes(id)) return "selected";
    return "idle";
  };

  const openModal = (platform: SocialPlatform) => {
    setOpenId(platform.id);
    setLocalHandle(answers[handleKey(platform.id)] || "");
    const followersVal = answers[followerKey(platform.id)];
    setLocalFollowers(
      followersVal === 0 || followersVal ? String(followersVal) : ""
    );
  };

  const saveSelection = (id: SocialId) => {
    if (!selected.includes(id)) {
      updateAnswer("social_selected_platforms", [...selected, id]);
    }
  };

  const saveAndClose = () => {
    if (!openId) return;
    const trimmedHandle = localHandle.trim();
    updateAnswer(handleKey(openId), trimmedHandle);
    updateAnswer(
      followerKey(openId),
      localFollowers ? Number(localFollowers) : null
    );
    updateAnswer(verifiedKey(openId), false);
    saveSelection(openId);
    setOpenId(null);
  };

  const handleConnect = async () => {
    if (!openId) return;
    const trimmedHandle = localHandle.trim();
    if (trimmedHandle) {
      updateAnswer(handleKey(openId), trimmedHandle);
      saveSelection(openId);
    }

    if (openId === "instagram" && onVerifyInstagram) {
      await onVerifyInstagram();
      setOpenId(null);
      return;
    }
    if (openId === "x" && onVerifyTwitter) {
      await onVerifyTwitter();
      setOpenId(null);
      return;
    }

    saveAndClose();
  };

  return (
    <div>
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
            state={stateFor(platform.id)}
            onClick={() => openModal(platform)}
          />
        ))}
      </div>

      {socialError && <div className="error">{socialError}</div>}
      <ValidationPill variant="error">Connection Failed</ValidationPill>
<ValidationPill variant="success">Verified</ValidationPill>
<ValidationPill variant="warning">Error. Please enter manually</ValidationPill>


      <Modal
        isOpen={Boolean(openId)}
        onClose={() => setOpenId(null)}
        size="sm"
        ariaLabel="Add social"
        className={styles.modal}
      >
        {openId && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <img
                  src={platforms.find((s) => s.id === openId)?.icon}
                  alt=""
                  width={22}
                  height={22}
                />
                <strong>{platforms.find((s) => s.id === openId)?.label}</strong>
              </div>
              <button onClick={() => setOpenId(null)}>×</button>
            </div>

            <label>
              Handle / URL
              <TextInput
                value={localHandle}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setLocalHandle(e.target.value)
                }
                placeholder="instagram.com/janeDoe"
              />
            </label>

            <label>
              Followers
              <TextInput
                type="number"
                value={localFollowers}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setLocalFollowers(e.target.value)
                }
                placeholder="30000"
              />
            </label>

            <div>
              <PrimaryButton
                onClick={handleConnect}
                aria-disabled={instagramVerifying}
              >
                {instagramVerifying ? "Connecting..." : "Submit →"}
              </PrimaryButton>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default SocialMediaStep;
