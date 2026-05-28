// Social Media Step Component (Rewritten)
// Social media handle collection with verification

import React, { useEffect, useMemo, useState, useCallback } from 'react';
import clsx from 'clsx';
import { Modal } from '@/ui/components/modals/Modal';
import SocialSelectorButton from '@/ui/components/inputs/buttons/SocialSelectorButton';
import styles from './SocialMediaStep.module.css';
import TextInput from '@/ui/components/inputs/text-inputs/TextInput';
import ValidationPill from '@/ui/components/inputs/buttons/ValidationPill';
import PrimaryButton from '@/ui/components/inputs/buttons/PrimaryButton';
import { apiClient } from '@/api/apis';
import { Endpoints } from '@/api/urls';
import { VERIFIABLE_PLATFORMS, PLATFORM_SERVICE_MAP, ERROR_MESSAGES } from '../utils/constants';
import { validateSocialHandle, parseFollowerCount } from '../validation/surveyValidation';

// Social platform icons
import igWhite from '@/assets/svg/iconSocialInstagramWhite.svg';
import igRed from '@/assets/svg/iconSocialInstagramRed.svg';
import tiktokWhite from '@/assets/svg/iconSocialTiktTokWhite.svg';
import tiktokRed from '@/assets/svg/iconSocialTiktTokRed.svg';
import snapWhite from '@/assets/svg/iconSocialSnapChatWhite.svg';
import snapRed from '@/assets/svg/iconSocialSnapChatRed.svg';
import telegramWhite from '@/assets/svg/iconSocialTelegramWhite.svg';
import telegramRed from '@/assets/svg/iconSocialTelegramRed.svg';
import xWhite from '@/assets/svg/iconSocialXWhite.svg';
import xRed from '@/assets/svg/iconSocialXRed.svg';
import onlyfansWhite from '@/assets/svg/iconSocialOnlyFansWhite.svg';
import onlyfansRed from '@/assets/svg/iconSocialOnlyFansRed.svg';
import whatsappWhite from '@/assets/svg/iconSocialWhatsAppWhite.svg';
import whatsappRed from '@/assets/svg/iconSocialWhatsAppRed.svg';

type SocialId = 'instagram' | 'tiktok' | 'snapchat' | 'telegram' | 'x' | 'onlyfans' | 'whatsapp';

interface SocialPlatform {
  id: SocialId;
  label: string;
  icon: string;
  iconError: string;
  placeholder: string;
}

interface SocialMediaStepProps {
  answers: Record<string, any>;
  socialError: string | null;
  verifyingSocial: Record<string, boolean>;
  onAnswerChange: (key: string, value: any) => void;
  onVerifyingSocialChange: (platform: string, verifying: boolean) => void;
  gridClassName?: string;
}

const platforms: SocialPlatform[] = [
  { id: 'onlyfans', label: 'Only Fans', icon: onlyfansWhite, iconError: onlyfansRed, placeholder: 'username' },
  { id: 'instagram', label: 'Instagram', icon: igWhite, iconError: igRed, placeholder: 'username' },
  { id: 'tiktok', label: 'TikTok', icon: tiktokWhite, iconError: tiktokRed, placeholder: 'username' },
  { id: 'snapchat', label: 'SnapChat', icon: snapWhite, iconError: snapRed, placeholder: 'username' },
  { id: 'telegram', label: 'Telegram', icon: telegramWhite, iconError: telegramRed, placeholder: 'handle' },
  { id: 'x', label: 'X', icon: xWhite, iconError: xRed, placeholder: 'username' },
  { id: 'whatsapp', label: 'Whatsapp', icon: whatsappWhite, iconError: whatsappRed, placeholder: 'phone or wa.me/number' },
];

// Key generators
const handleKey = (id: SocialId) => `social_${id}`;
const followerKey = (id: SocialId) => `social_${id}_followers`;
const verifiedKey = (id: SocialId) => `social_${id}_verified`;
const errorKey = (id: SocialId) => `social_${id}_verify_error`;

const SocialMediaStep: React.FC<SocialMediaStepProps> = ({
  answers,
  socialError,
  verifyingSocial,
  onAnswerChange,
  onVerifyingSocialChange,
  gridClassName,
}) => {
  // Modal state
  const [openId, setOpenId] = useState<SocialId | null>(null);
  const [localHandle, setLocalHandle] = useState('');
  const [localFollowers, setLocalFollowers] = useState('');

  // Get selected platforms list
  const selected = useMemo<string[]>(
    () => (Array.isArray(answers['social_selected_platforms']) ? answers['social_selected_platforms'] : []),
    [answers]
  );

  // Determine button state for a platform
  const stateFor = useCallback(
    (id: SocialId): 'idle' | 'selected' | 'error' => {
      if (answers[errorKey(id)]) return 'error';
      if (answers[verifiedKey(id)]) return 'selected';
      if (answers[handleKey(id)]) return 'selected';
      if (selected.includes(id)) return 'selected';
      return 'idle';
    },
    [answers, selected]
  );

  // Open modal for a platform
  const openModal = useCallback(
    (platform: SocialPlatform) => {
      setOpenId(platform.id);
      setLocalHandle(answers[handleKey(platform.id)] || '');
      const followersVal = answers[followerKey(platform.id)];
      setLocalFollowers(followersVal === 0 || followersVal ? String(followersVal) : '');
    },
    [answers]
  );

  // Add platform to selected list
  const saveSelection = useCallback(
    (id: SocialId) => {
      if (!selected.includes(id)) {
        onAnswerChange('social_selected_platforms', [...selected, id]);
      }
    },
    [selected, onAnswerChange]
  );

  // Remove platform from selected list
  const removeSelection = useCallback(
    (id: SocialId) => {
      if (selected.includes(id)) {
        onAnswerChange(
          'social_selected_platforms',
          selected.filter((item) => item !== id)
        );
      }
    },
    [selected, onAnswerChange]
  );

  // Save manually entered data and close modal
  const saveManualAndClose = useCallback(() => {
    if (!openId) return;

    const trimmedHandle = localHandle.trim();
    const parsedFollowers = parseFollowerCount(localFollowers);

    onAnswerChange(handleKey(openId), trimmedHandle);
    onAnswerChange(followerKey(openId), parsedFollowers);
    onAnswerChange(verifiedKey(openId), false);

    if (!trimmedHandle) {
      removeSelection(openId);
      onAnswerChange(errorKey(openId), ERROR_MESSAGES.SOCIAL_HANDLE_REQUIRED);
      return;
    }

    // Require at least 1 follower
    if (parsedFollowers <= 0) {
      removeSelection(openId);
      onAnswerChange(errorKey(openId), 'Must have at least 1 follower');
      return;
    }

    onAnswerChange(errorKey(openId), null);
    saveSelection(openId);
    setOpenId(null);
  }, [openId, localHandle, localFollowers, onAnswerChange, removeSelection, saveSelection]);

  // Verify social media handle via API
  const handleConnect = useCallback(async () => {
    if (!openId) return;
    if (verifyingSocial?.[openId]) return;

    const canConnect = VERIFIABLE_PLATFORMS.has(openId);
    const trimmedHandle = localHandle.trim();
    const parsedFollowers = parseFollowerCount(localFollowers);

    onAnswerChange(followerKey(openId), parsedFollowers);
    onAnswerChange(handleKey(openId), trimmedHandle);

    // If platform doesn't support verification, save manually
    if (!canConnect) {
      saveManualAndClose();
      return;
    }

    // Validate handle before connecting
    const handleError = validateSocialHandle(trimmedHandle);
    if (handleError) {
      removeSelection(openId);
      onAnswerChange(errorKey(openId), ERROR_MESSAGES.SOCIAL_HANDLE_REQUIRED_CONNECT);
      return;
    }

    // Save to selected list and clear errors
    saveSelection(openId);
    onAnswerChange(errorKey(openId), null);
    onAnswerChange(verifiedKey(openId), false);

    // Start verification
    onVerifyingSocialChange(openId, true);

    try {
      const service = PLATFORM_SERVICE_MAP[openId] || openId;
      const cleanHandle = trimmedHandle.replace(/^@/, '');

      const { data } = await apiClient.get(Endpoints.social.followers, {
        params: { service, username: cleanHandle },
      });

      if (!data?.success) {
        throw new Error('Provider returned success=false');
      }

      // Success - update with verified data
      onAnswerChange(handleKey(openId), data.username ?? cleanHandle);
      onAnswerChange(followerKey(openId), data.count ?? null);
      onAnswerChange(verifiedKey(openId), true);
    } catch (error: any) {
      console.error('Social verification failed:', error);

      const backendMsg = error?.response?.data?.detail;
      const msg = Array.isArray(backendMsg)
        ? backendMsg.map((d: any) => d?.msg).filter(Boolean).join(' ')
        : backendMsg || ERROR_MESSAGES.SOCIAL_CONNECTION_FAILED;

      onAnswerChange(errorKey(openId), msg);
      onAnswerChange(verifiedKey(openId), false);
    } finally {
      onVerifyingSocialChange(openId, false);
    }
  }, [
    openId,
    localHandle,
    localFollowers,
    verifyingSocial,
    onAnswerChange,
    saveManualAndClose,
    removeSelection,
    saveSelection,
    onVerifyingSocialChange,
  ]);

  // Determine modal status
  const modalStatus = useCallback((): 'idle' | 'verifying' | 'verified' | 'error' => {
    if (!openId) return 'idle';
    if (verifyingSocial?.[openId]) return 'verifying';
    if (answers[verifiedKey(openId)]) return 'verified';
    if (answers[errorKey(openId)]) return 'error';
    return 'idle';
  }, [openId, verifyingSocial, answers]);

  // Sync follower count when verified
  useEffect(() => {
    if (!openId) return;
    const val = answers[followerKey(openId)];
    if (val === undefined || val === null || val === '') return;
    setLocalFollowers(String(val));
  }, [openId, answers]);

  const modalPlatform = openId ? platforms.find((p) => p.id === openId) : null;
  const canConnect = openId ? VERIFIABLE_PLATFORMS.has(openId) : false;
  const status = modalStatus();
  const rawError = openId ? answers[errorKey(openId)] : null;
  const errorMsg = typeof rawError === 'string' ? rawError : ERROR_MESSAGES.SOCIAL_CONNECTION_FAILED;
  const showPrimary = status !== 'verified';
  const primaryLabel =
    status === 'verifying' ? 'Connecting...' : canConnect && status !== 'error' ? 'Connect' : 'Submit';

  return (
    <div>
      <div className={clsx(styles.socialGrid, gridClassName)}>
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
              <button className={styles.closeButton} onClick={() => setOpenId(null)}>
                ×
              </button>
            </div>

            <div className={styles.inputGroup}>
              <label className={styles.inputLabel}>Handle</label>
              <TextInput
                value={localHandle}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                  setLocalHandle(e.target.value);
                  // Clear verification if handle changes
                  if (openId && e.target.value !== answers[handleKey(openId)]) {
                    onAnswerChange(verifiedKey(openId), false);
                  }
                }}
                placeholder={modalPlatform.placeholder}
                className={styles.textInput}
              />
            </div>

            <div className={styles.inputGroup}>
              <label className={styles.inputLabel}>Follower Count</label>
              <TextInput
                type="number"
                value={localFollowers}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setLocalFollowers(e.target.value)}
                placeholder="Followers"
                className={styles.textInput}
              />
            </div>

            <div className={styles.modalActions}>
              {showPrimary && (
                <PrimaryButton
                  className={`${styles.submitButton} ${status === 'verifying' ? styles.disabled : ''}`}
                  onClick={status === 'error' || !canConnect ? saveManualAndClose : handleConnect}
                  aria-disabled={status === 'verifying'}
                  text={primaryLabel}
                />
              )}

              {status === 'error' && errorMsg && (
                <ValidationPill variant="error" className={styles.validationPill}>
                  {errorMsg}
                </ValidationPill>
              )}

              {status === 'verified' && (
                <ValidationPill variant="success" className={styles.validationPill}>
                  Verified
                </ValidationPill>
              )}

              {status === 'error' && (
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
