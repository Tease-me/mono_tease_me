import React from "react";
import styles from "./../ProfileSurvey.module.css";

interface SocialMediaStepProps {
  answers: Record<string, any>;
  updateAnswer: (key: string, value: any) => void;
  socialError: string | null;
  onVerifyInstagram: () => void;
  onVerifyTwitter: () => void;
  instagramVerifying: boolean;
}

const SocialMediaStep: React.FC<SocialMediaStepProps> = ({
  answers,
  updateAnswer,
  socialError,
  onVerifyInstagram,
  onVerifyTwitter,
  instagramVerifying,
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

      {/* INSTAGRAM + VERIFY */}
      <div className={styles.field}>
        <label className={styles.label}>Instagram</label>

        <div className={styles.inlineGroup}>
          <input
            className={styles.input}
            placeholder="@username"
            value={answers["social_instagram"] || ""}
            onChange={(e) => {
              updateAnswer("social_instagram", e.target.value);
              updateAnswer("social_instagram_verified", false);
              updateAnswer("social_instagram_verify_error", null);
              updateAnswer("social_instagram_followers", null);
            }}
          />

          <button
            type="button"
            className={styles.verifyButton}
            onClick={onVerifyInstagram}
            disabled={!answers["social_instagram"] || instagramVerifying}
          >
            {instagramVerifying ? "Verifying..." : "Verify"}
          </button>
        </div>

        {answers["social_instagram_verified"] && (
          <div className={styles.subtitleSuccess}>
            {answers["social_instagram_followers"]?.toLocaleString() || "0"}{" "}
            followers
          </div>
        )}

        {answers["social_instagram_verify_error"] && (
          <div className={styles.error}>
            {answers["social_instagram_verify_error"]}
          </div>
        )}
      </div>

      {/* RESTO IGUAL */}
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

        <div className={styles.inlineGroup}>
          <input
            className={styles.input}
            placeholder="@username"
            value={answers["social_x"] || ""}
            onChange={(e) => {
              updateAnswer("social_x", e.target.value);
              updateAnswer("social_twitter_verified", false);
              updateAnswer("social_twitter_verify_error", null);
              updateAnswer("social_twitter_followers", null);
            }}
          />

          <button
            type="button"
            className={styles.verifyButton}
            onClick={onVerifyTwitter}
            disabled={!answers["social_x"] || instagramVerifying}
          >
            {instagramVerifying ? "Verifying..." : "Verify"}
          </button>
        </div>

        {answers["social_twitter_verified"] && (
          <div className={styles.subtitleSuccess}>
            {answers["social_twitter_followers"]?.toLocaleString() || "0"}{" "}
            followers
          </div>
        )}

        {answers["social_twitter_verify_error"] && (
          <div className={styles.error}>
            {answers["social_twitter_verify_error"]}
          </div>
        )}
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
