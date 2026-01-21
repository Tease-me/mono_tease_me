import React from "react";
import surveyStyles from "../ProfileSurvey.module.css";
import styles from "./UploadPictureStep.module.css";
import iconCheckCircle from "@/assets/svg/iconCheckCircle.svg";
import iconCross from "@/assets/svg/iconCross.svg";
import ProfileMedia from "@/ui/components/ProfileMedia";
import defaultProfilePic from "@/assets/image/avatar.png";
import IconButton from "@/ui/components/inputs/buttons/IconButton";
import SvgPack from '@/utils/SvgPack';
import NormalButton from "@/ui/components/inputs/buttons/NormalButton";
import ImageCropModal from "@/ui/components/modals/image-crop-modal/ImageCropModal";


type Props = {
  uploading: boolean;
  pictureUrl: string | null;
  pictureError: string | null;
  onSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
  inputRef: React.RefObject<HTMLInputElement | null>;
  name: string;
  isCropOpen: boolean;
  cropImageSrc: string | null;
  onCropClose: () => void;
  onCropComplete: (blob: Blob, dataUrl: string) => void;
};


const UploadPictureStep: React.FC<Props> = ({
  uploading,
  pictureUrl,
  pictureError,
  onSelect,
  inputRef,
  name,
  isCropOpen,
  cropImageSrc,
  onCropClose,
  onCropComplete
}) => (

  <div className={styles.uploadPictureStep}>
    <p className={surveyStyles.surveySubtitle}>Upload your best clear profile photo. This will be used as TeaseMe profile photo.</p><br></br>
    <label className={surveyStyles.label}>
      Photo Tips
    </label>
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
        {uploading &&
          <div className={surveyStyles.label}>Uploading…</div>}
        {pictureError &&
          <div className={surveyStyles.error}>{pictureError}</div>}
      </div>

      <NormalButton
        type="square"
        color="black"
        leftIcon={<SvgPack.UploadPhoto />}
        text={uploading ? "Uploading…" : "Upload Photo"}
        aria-disabled={uploading}
        onClick={() => inputRef.current?.click()}
      />

      <input
        id="profile-picture-upload"
        ref={inputRef}
        className={styles.hiddenInput}
        type="file"
        accept="image/*"
        onChange={onSelect}
        disabled={uploading}
      />
    </div>



    {/* PHOTO UPLOAD SECTION :) 
    <label className={styles.dropzone} htmlFor="profile-picture-upload">
      <div className={styles.dropContent}>
        <div className={styles.dropTitle}>
          {pictureUrl ? "Replace picture" : "Upload picture"}
        </div>
        <p className={styles.dropHint}>JPG or PNG, max 10MB.</p>
      </div>
      <input
        id="profile-picture-upload"
        ref={inputRef}
        className={styles.hiddenInput}
        type="file"
        accept="image/*"
        onChange={onSelect}
      />
    </label>
    */}

    {/* PREVIEW SECTION  :) */}


    <div className={styles.previewSection}>
      <label className={styles.label}>Preview</label>
      <div className={styles.previewCard}>

        <div className={styles.previewLeft}>
          <ProfileMedia
            key={pictureUrl || "default"} // force re-mount when URL changes
            className={styles.previewAvatar}
            size="medium"
            active
            mediaType="image"
            imageSrc={pictureUrl || defaultProfilePic}
            altText="Preview photo"
          />
        </div>

        <div className={styles.previewRight}>
          <h2 className={styles.previewTitle}>{name}</h2>
          <p className={surveyStyles.surveySubtitle}>00:15</p>

          <div className={styles.previewButtons}>
            <IconButton leftIcon={<SvgPack.Speaker />} color='black' />
            <IconButton leftIcon={<SvgPack.Voice />} color='black' />
            <IconButton leftIcon={<SvgPack.Call />} color='red' />
          </div>
        </div>
      </div>
    </div>

    {cropImageSrc && (
      <ImageCropModal
        isOpen={isCropOpen}
        imageSrc={cropImageSrc}
        onClose={onCropClose}
        onCropComplete={onCropComplete}
      />
    )}

    {/*}
    {uploading && <div className={surveyStyles.subtitle}>Uploading…</div>}

    {pictureUrl && !uploading && (
      <div className={styles.previewWrapper}>
        <div className={surveyStyles.subtitle}>Current picture:</div>
        <img
          src={pictureUrl}
          alt="Influencer profile"
          className={styles.preview}
        />
      </div>
    )}

    {pictureError && <div className={surveyStyles.error}>{pictureError}</div>}

    */}
  </div>
);

export default UploadPictureStep;
