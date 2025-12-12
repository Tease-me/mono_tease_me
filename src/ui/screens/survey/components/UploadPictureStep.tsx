import React from "react";
import surveyStyles from "../ProfileSurvey.module.css";
import styles from "./UploadPictureStep.module.css";

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
    <label className={surveyStyles.label}>
      Picture of influencer <span className={surveyStyles.required}>*</span>
    </label>
    <p className={surveyStyles.subtitle}>
      Upload a clear profile picture. This will be used in your TeaseMe profile.
    </p>

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
