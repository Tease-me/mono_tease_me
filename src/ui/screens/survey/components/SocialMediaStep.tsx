import React, { useEffect, useMemo, useState } from "react";
import { Modal } from "@/ui/components/modals/Modal";
import SocialSelectorButton from "@/ui/components/inputs/buttons/SocialSelectorButton";
import styles from "./SocialMediaStep.module.css"
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
import PrimaryButton from "@/ui/components/inputs/buttons/PrimaryButton";




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
  placeholder: string;
}

interface SocialMediaStepProps {
  answers: Record<string, any>;
  updateAnswer: (key: string, value: any) => void;
  socialError: string | null;
  onVerifySocial?: (platform: SocialId, handle: string) => Promise<void> | void;
  verifyingSocial?: Record<string, boolean>;
}

const platforms: SocialPlatform[] = [
  { id: "instagram", label: "Instagram", icon: igWhite, iconError: igRed, placeholder: "username" },
  { id: "tiktok", label: "TikTok", icon: tiktokWhite, iconError: tiktokRed, placeholder: "username" },
  { id: "snapchat", label: "SnapChat", icon: snapWhite, iconError: snapRed, placeholder: "username" },
  { id: "telegram", label: "Telegram", icon: telegramWhite, iconError: telegramRed, placeholder: "handle" },
  { id: "x", label: "X", icon: xWhite, iconError: xRed, placeholder: "username" },
  { id: "onlyfans", label: "Only Fans", icon: onlyfansWhite, iconError: onlyfansRed, placeholder: "username" },
  { id: "whatsapp", label: "Whatsapp", icon: whatsappWhite, iconError: whatsappRed, placeholder: "phone or wa.me/number" },
];


const handleKey = (id: SocialId) => `social_${id}`;
const followerKey = (id: SocialId) => `social_${id}_followers`;
const verifiedKey = (id: SocialId) => `social_${id}_verified`;
const errorKey = (id: SocialId) => `social_${id}_verify_error`;
const connectable = new Set<SocialId>(["instagram", "x"]);

const SocialMediaStep: React.FC<SocialMediaStepProps> = ({
  answers,
  updateAnswer,
  socialError,
  onVerifySocial,
  verifyingSocial,
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

  const saveManualAndClose = () => {
    if (!openId) return;
    const trimmedHandle = localHandle.trim();
    updateAnswer(handleKey(openId), trimmedHandle);
    updateAnswer(
      followerKey(openId),
      localFollowers ? Number(localFollowers) : null
    );
    updateAnswer(verifiedKey(openId), false);
    updateAnswer(errorKey(openId), null);
    saveSelection(openId);
    setOpenId(null);
  };

  const handleConnect = async () => {
    if (!openId) return;
    const canConnect = connectable.has(openId);
    const trimmedHandle = localHandle.trim();

    if (!canConnect) {
      saveManualAndClose();
      return;
    }

    updateAnswer(errorKey(openId), null);
    updateAnswer(verifiedKey(openId), false);

    try {
      if (onVerifySocial) {
        await onVerifySocial(openId, trimmedHandle);
      } else {
        saveManualAndClose();
        return;
      }
      // parent sets verified/error state; keep modal open to reflect status
    } catch (err) {
      console.error("Error connecting social", err);
      updateAnswer(
        errorKey(openId),
        "Connection failed."
      );
    }
  };

  const modalStatus = (): "idle" | "verifying" | "verified" | "error" => {
    if (!openId) return "idle";
    if (verifyingSocial?.[openId]) return "verifying";
    if (answers[verifiedKey(openId)]) return "verified";
    if (answers[errorKey(openId)]) return "error";
    return "idle";
  };

  useEffect(() => {
    if (!openId) return;
    const val = answers[followerKey(openId)];
    if (val === undefined || val === null || val === "") return;
    setLocalFollowers(String(val));
  }, [openId, answers]);

  const modalPlatform = openId ? platforms.find((p) => p.id === openId) : null;
  const canConnect = openId ? connectable.has(openId) : false;
  const status = modalStatus();
  const rawError = openId ? answers[errorKey(openId)] : null;
  const errorMsg = typeof rawError === "string" ? rawError : "Connection failed.";
  const showPrimary = status !== "verified";
  const primaryLabel =
    status === "verifying"
      ? "Connecting..."
      : canConnect && status !== "error"
        ? "Connect"
        : "Submit";

  return (
    <div>
      <div className={styles.socialGrid}>
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

      {socialError && <div className={styles.error}>{socialError}</div>}

      <Modal
        isOpen={Boolean(openId)}
        onClose={() => setOpenId(null)}
        size="sm"
        ariaLabel="Add social"
        className={styles.modal}
      >
        {modalPlatform && (
          <div className={styles.modalCard}>
            <div className={styles.modalHeader}>
              {/*

              <div className={styles.modalTitle}>
                <img src={modalPlatform.icon} alt="" className={styles.modalIcon} />
                <strong>{modalPlatform.label}</strong>
              </div> 
               */}
              <button className={styles.closeButton} onClick={() => setOpenId(null)}>×</button>
            </div>


            <div className={styles.inputGroup}>
              <label className={styles.inputLabel}>Handle</label>
              <TextInput
                value={localHandle}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setLocalHandle(e.target.value)
                }
                placeholder={modalPlatform.placeholder}
                className={styles.textInput}
              />
            </div>

            <div className={styles.inputGroup}>
              <label className={styles.inputLabel}>Follower Count</label>
              <TextInput
                type="number"
                value={localFollowers}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setLocalFollowers(e.target.value)
                }
                placeholder="Followers"
                className={styles.textInput}
              />
            </div>

            <div className={styles.modalActions}>
              {showPrimary && (
                <PrimaryButton
                  className={`${styles.submitButton} ${status === "verifying" ? styles.disabled : ""}`}
                  onClick={status === "error" || !canConnect ? saveManualAndClose : handleConnect}
                  aria-disabled={status === "verifying"}
                  text={primaryLabel}
                />
              )}

              {status === "error" && errorMsg && (
                <ValidationPill variant="error" className={styles.validationPill}>
                  {errorMsg}
                </ValidationPill>
              )}

              {status === "verified" && (
                <ValidationPill variant="success" className={styles.validationPill}>
                  Verified
                </ValidationPill>
              )}

              {status === "error" && (
                <ValidationPill variant="warning" className={styles.validationPill}>
                  Please enter manually
                </ValidationPill>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default SocialMediaStep;
