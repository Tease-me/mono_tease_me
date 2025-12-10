import React from "react";
import styles from "./../ProfileSurvey.module.css";

interface SocialMediaStepProps {
  answers: Record<string, any>;
  updateAnswer: (key: string, value: any) => void;
  socialError: string | null;
}

const SocialMediaStep: React.FC<SocialMediaStepProps> = ({
  answers,
  updateAnswer,
  socialError,
}) => {
  return (
    <div className={styles.field}>
      <label className={styles.label}>
        Social Media <span className={styles.required}>*</span>
      </label>
      <p className={styles.subtitle}>
        Add all social media where your fans can find you. At least one is
        required.
      </p>

      <div className={styles.field}>
        <label className={styles.label}>Instagram</label>
        <input
          className={styles.input}
          placeholder="@username"
          value={answers["social_instagram"] || ""}
          onChange={(e) => updateAnswer("social_instagram", e.target.value)}
        />
      </div>

      <div className={styles.field}>
        <label className={styles.label}>TikTok</label>
        <input
          className={styles.input}
          placeholder="@username"
          value={answers["social_tiktok"] || ""}
          onChange={(e) => updateAnswer("social_tiktok", e.target.value)}
        />
      </div>

      <div className={styles.field}>
        <label className={styles.label}>OnlyFans</label>
        <input
          className={styles.input}
          placeholder="@username"
          value={answers["social_onlyfans"] || ""}
          onChange={(e) => updateAnswer("social_onlyfans", e.target.value)}
        />
      </div>

      <div className={styles.field}>
        <label className={styles.label}>Snapchat</label>
        <input
          className={styles.input}
          placeholder="@username"
          value={answers["social_snapchat"] || ""}
          onChange={(e) => updateAnswer("social_snapchat", e.target.value)}
        />
      </div>

      <div className={styles.field}>
        <label className={styles.label}>X (Twitter)</label>
        <input
          className={styles.input}
          placeholder="@username"
          value={answers["social_x"] || ""}
          onChange={(e) => updateAnswer("social_x", e.target.value)}
        />
      </div>

      <div className={styles.field}>
        <label className={styles.label}>Telegram</label>
        <input
          className={styles.input}
          placeholder="@username"
          value={answers["social_telegram"] || ""}
          onChange={(e) => updateAnswer("social_telegram", e.target.value)}
        />
      </div>

      <div className={styles.field}>
        <label className={styles.label}>WhatsApp</label>
        <input
          className={styles.input}
          placeholder="Phone or link"
          value={answers["social_whatsapp"] || ""}
          onChange={(e) => updateAnswer("social_whatsapp", e.target.value)}
        />
      </div>

      {socialError && <div className={styles.error}>{socialError}</div>}
    </div>
  );
};

export default SocialMediaStep;
