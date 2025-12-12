import React from "react";
import surveyStyles from "../ProfileSurvey.module.css";
import styles from "./UploadPictureStep.module.css";
import iconCheckCircle from "@/assets/svg/iconCheckCircle.svg";
import iconCross from "@/assets/svg/iconCross.svg";


type Props = {
  uploading: boolean;
  pictureUrl: string | null;
  pictureError: string | null;
  onSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
  inputRef: React.RefObject<HTMLInputElement | null>;
};

const UploadPictureStep: React.FC<Props> = ({
  uploading,
  pictureUrl,
  pictureError,
  onSelect,
  inputRef,
}) => (
  <div className={surveyStyles.field}>
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
  </div>
);

export default UploadPictureStep;
