// Upload Picture Step Component (Rewritten)
// Profile picture upload with validation guards and crop modal

import React, { useRef, useEffect, useCallback } from 'react';
import surveyStyles from '../ProfileSurvey.module.css';
import styles from './UploadPictureStep.module.css';
import iconCheckCircle from '@/assets/svg/iconCheckCircle.svg';
import iconCross from '@/assets/svg/iconCross.svg';
import ProfileMedia from '@/ui/components/ProfileMedia';
import NormalButton from '@/ui/components/inputs/buttons/NormalButton';
import IconButton from '@/ui/components/inputs/buttons/IconButton';
import SvgPack from '@/utils/SvgPack';
import ImageCropModal from '@/ui/components/modals/image-crop-modal/ImageCropModal';
import { validateImageFile } from '../utils/fileUploadHelpers';
import { useFileUpload } from '../hooks/useFileUpload';
import { apiClient } from '@/api/apis';

interface UploadPictureStepProps {
  preInfluencerId: number | null;
  preInfluencerUsername: string | null;
  token: string;
  temp_password: string;
  pictureUrl: string | null;
  pictureError: string | null;
  uploadingPicture: boolean;
  isCropOpen: boolean;
  cropImageSrc: string | null;
  onPictureUrlChange: (url: string | null) => void;
  onPictureKeyChange: (key: string) => void;
  onUploadingChange: (uploading: boolean) => void;
  onErrorChange: (error: string | null) => void;
  onCropOpenChange: (open: boolean) => void;
  onCropImageSrcChange: (src: string | null) => void;
  onAnswerChange: (key: string, value: any) => void;
}

const UploadPictureStep: React.FC<UploadPictureStepProps> = ({
  preInfluencerId,
  preInfluencerUsername,
  token,
  temp_password,
  pictureUrl,
  pictureError,
  uploadingPicture,
  isCropOpen,
  cropImageSrc,
  onPictureUrlChange,
  onPictureKeyChange,
  onUploadingChange,
  onErrorChange,
  onCropOpenChange,
  onCropImageSrcChange,
  onAnswerChange,
}) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const pendingFileRef = useRef<File | null>(null);
  const objectUrlRef = useRef<string | null>(null);
  const { uploadProfilePicture } = useFileUpload();

  // Cleanup object URLs on unmount
  useEffect(() => {
    return () => {
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
      }
    };
  }, []);

  // Fetch picture URL from server when key changes
  useEffect(() => {
    if (!preInfluencerId) return;

    const pictureKey = onAnswerChange ? undefined : pictureUrl; // Get from answers
    // This effect should fetch the URL based on the profile_picture_key in answers
    // For now, we'll rely on the parent to manage this
  }, [preInfluencerId]);

  // Handle file selection with validation guards
  const handlePictureSelect = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file || !preInfluencerId) return;

      onErrorChange(null);

      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
      if (isIOS && file.type === 'image/webp') {
        const match = navigator.userAgent.match(/OS (\d+)_(\d+)_?(\d+)?/);
        const iOSVersion = match ? parseFloat(match[1]) : 14;
        if (iOSVersion < 14) {
          onErrorChange('WebP images are not supported on your iOS version. Please use JPEG or PNG.');
          if (fileInputRef.current) fileInputRef.current.value = '';
          return;
        }
      }

      const validation = await validateImageFile(file);
      if (!validation.valid) {
        onErrorChange(validation.error || 'Invalid image file');
        if (fileInputRef.current) fileInputRef.current.value = '';
        return;
      }

      // Validation passed - create object URL for crop
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
      }

      const localUrl = URL.createObjectURL(file);
      objectUrlRef.current = localUrl;
      pendingFileRef.current = file;

      onCropImageSrcChange(localUrl);
      onCropOpenChange(true);
    },
    [preInfluencerId, onErrorChange, onCropImageSrcChange, onCropOpenChange]
  );

  // Handle crop modal close
  const handleCloseCrop = useCallback(() => {
    onCropOpenChange(false);
    onCropImageSrcChange(null);
    pendingFileRef.current = null;

    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, [onCropOpenChange, onCropImageSrcChange]);

  // Handle crop complete and upload
  const handleCropComplete = useCallback(
    async (blob: Blob, dataUrl: string) => {
      if (!preInfluencerId) return;

      onCropOpenChange(false);
      onCropImageSrcChange(null);

      // Show local preview immediately
      onPictureUrlChange(dataUrl);
      onUploadingChange(true);
      onErrorChange(null);

      try {
        // Create File from blob
        const originalFile = pendingFileRef.current;
        const fileName = originalFile?.name || 'profile.jpg';
        const fileType = blob.type || originalFile?.type || 'image/jpeg';
        const croppedFile = new File([blob], fileName, { type: fileType });

        // Upload with validation
        const result = await uploadProfilePicture({
          file: croppedFile,
          preInfluencerId,
          token,
          temp_password,
        });

        if (result.success) {
          if (!result.s3_key) {
            throw new Error('Upload succeeded but no S3 key returned');
          }
          onAnswerChange('profile_picture_key', result.s3_key);
          onPictureKeyChange(result.s3_key);

          setTimeout(async () => {
            try {
              const { data } = await apiClient.get<{ url: string }>(
                `/pre-influencers/${preInfluencerId}/picture-url`,
                { params: { token, temp_password } }
              );
              onPictureUrlChange(data.url);
            } catch (err) {
              console.error('Failed to fetch picture URL:', err);
              // Keep local preview if fetch fails
            }
          }, 500);
        } else {
          throw new Error(result.error || 'Upload failed');
        }
      } catch (error) {
        console.error('Picture upload error:', error);
        onErrorChange('Error uploading picture. Please try again.');
        onPictureUrlChange(null);
      } finally {
        onUploadingChange(false);
        pendingFileRef.current = null;

        if (objectUrlRef.current) {
          URL.revokeObjectURL(objectUrlRef.current);
          objectUrlRef.current = null;
        }

        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      }
    },
    [
      preInfluencerId,
      token,
      temp_password,
      uploadProfilePicture,
      onCropOpenChange,
      onCropImageSrcChange,
      onPictureUrlChange,
      onPictureKeyChange,
      onUploadingChange,
      onErrorChange,
      onAnswerChange,
    ]
  );

  return (
    <div className={styles.uploadPictureStep}>
      <p className={surveyStyles.surveySubtitle}>
        Upload your best clear profile photo. This will be used as TeaseMe profile photo.
      </p>
      <br />

      <label className={surveyStyles.label}>Photo Tips</label>
      <ul className={styles.tipsList}>
        <li className={styles.tip}>
          <img className={styles.tipIcon} src={iconCheckCircle} alt="" />
          Face camera directly
        </li>
        <li className={styles.tip}>
          <img className={styles.tipIcon} src={iconCheckCircle} alt="" />
          Neutral simple background
        </li>
        <li className={styles.tip}>
          <img className={styles.tipIcon} src={iconCross} alt="" />
          Crop face or head
        </li>
        <li className={styles.tip}>
          <img className={styles.tipIcon} src={iconCross} alt="" />
          Full body shot
        </li>
      </ul>

      <div className={styles.uploadArea}>
        <div className={surveyStyles.label}>Current Photo</div>

        <ProfileMedia
          className={styles.previewAvatar}
          size="xlarge"
          active
          mediaType="image"
          imageSrc={pictureUrl || undefined}
          altText="Current photo"
        />

        <div className={styles.uploadStateArea}>
          {uploadingPicture && <div className={surveyStyles.label}>Uploading…</div>}
          {pictureError && <div className={surveyStyles.error}>{pictureError}</div>}
        </div>

        <NormalButton
          type="square"
          color="black"
          leftIcon={<SvgPack.UploadPhoto />}
          text={uploadingPicture ? 'Uploading…' : 'Upload Photo'}
          aria-disabled={uploadingPicture}
          onClick={() => fileInputRef.current?.click()}
        />

        <input
          ref={fileInputRef}
          className={styles.hiddenInput}
          type="file"
          accept="image/*"
          onChange={handlePictureSelect}
          disabled={uploadingPicture}
        />
      </div>

      {/* Preview Section */}
      <div className={styles.previewSection}>
        <label className={styles.label}>Preview</label>
        <div className={styles.previewCard}>
          <div className={styles.previewLeft}>
            <ProfileMedia
              key={pictureUrl || 'default'}
              className={styles.previewAvatar}
              size="medium"
              active
              mediaType="image"
              imageSrc={pictureUrl || undefined}
              altText="Preview photo"
            />
          </div>

          <div className={styles.previewRight}>
            <h2 className={styles.previewTitle}>{preInfluencerUsername || 'Your Name'}</h2>
            <p className={surveyStyles.surveySubtitle}>00:15</p>

            <div className={styles.previewButtons}>
              <IconButton leftIcon={<SvgPack.Speaker />} color="black" />
              <IconButton leftIcon={<SvgPack.Voice />} color="black" />
              <IconButton leftIcon={<SvgPack.Call />} color="red" />
            </div>
          </div>
        </div>
      </div>

      {/* Crop Modal */}
      {cropImageSrc && (
        <ImageCropModal
          isOpen={isCropOpen}
          imageSrc={cropImageSrc}
          onClose={handleCloseCrop}
          onCropComplete={handleCropComplete}
        />
      )}
    </div>
  );
};

export default UploadPictureStep;
