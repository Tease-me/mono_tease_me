import React, { Suspense } from 'react';
import ProfileMedia from '@/ui/components/ProfileMedia';
import TextInput from '@/ui/components/inputs/text-inputs/TextInput';
import SvgPack from '@/utils/SvgPack';
import styles from './AssetUploadStep.module.css';

interface AssetUploadStepProps {
  pictureUrl: string | null;
  username: string | null;
  assetLink: string;
  assetError: string | null;
  onAssetLinkChange: (value: string) => void;
}

const AssetUploadStep: React.FC<AssetUploadStepProps> = ({
  pictureUrl,
  username,
  assetLink,
  assetError,
  onAssetLinkChange,
}) => {
  return (
    <div className={styles.container}>
      <div className={styles.profileCard}>
        <ProfileMedia
          size="medium"
          mediaType="image"
          imageSrc={pictureUrl ?? undefined}
          altText={username || 'Profile'}
          active
        />
        <div className={styles.profileInfo}>
          <span className={styles.username}>{username}</span>
          <span className={styles.pendingBadge}>Profile is [Pending]</span>
        </div>
      </div>

      <div className={styles.linkContainer}>
        <label className={styles.linkLabel}>Paste link to assets here</label>
        <TextInput
          type="url"
          placeholder="eg. https://drive.google.com/file/d/IDNRe..."
          value={assetLink}
          onChange={(e) => onAssetLinkChange(e.target.value)}
          className={styles.linkInputWrapper}
        />
        <div className={styles.platforms}>
          <span className={styles.platformHint}>
            <Suspense fallback={null}><SvgPack.GoogleDrive className={styles.platformIcon} /></Suspense>
            Google Drive
          </span>
          <span className={styles.platformHint}>
            <Suspense fallback={null}><SvgPack.DropBox className={styles.platformIcon} /></Suspense>
            DropBox
          </span>
          <span className={styles.platformHint}>
            <Suspense fallback={null}><SvgPack.ICloud className={styles.platformIcon} /></Suspense>
            iCloud
          </span>
        </div>
        {assetError && <p className={styles.error}>{assetError}</p>}
      </div>

      <div className={styles.privacyNote}>
        <p className={styles.privacyTitle}>Our Commitment to Your Privacy</p>
        <p className={styles.privacyText}>
          Your assets will be used exclusively to create your TeaseMe Persona and{' '}
          <span className={styles.underline}>will not be shared</span>
          {' '}with third parties. If you prefer to share your assets via a different platform (such as
          Telegram or WhatsApp), please notify your account manager.
        </p>
      </div>
    </div>
  );
};

export default AssetUploadStep;
