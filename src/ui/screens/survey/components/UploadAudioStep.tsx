import React, { useRef } from "react";
import surveyStyles from "../ProfileSurvey.module.css";
import styles from "./UploadAudioStep.module.css";
import NormalButton from "@/ui/components/inputs/buttons/NormalButton";
import IconButton from "@/ui/components/inputs/buttons/IconButton";
import InfluencerAudioManager from "../../influencer-audio-manager/InfluencerAudioManager";
import iconCheckCircle from "@/assets/svg/iconCheckCircle.svg";
import iconCross from "@/assets/svg/iconCross.svg";
import SvgPack from "@/utils/SvgPack";

interface UploadAudioStepProps {
  influencerId: string;
  onCountChange: (count: number) => void;
  audioError: string | null;
  setAudioError: (msg: string | null) => void;
}

const UploadAudioStep: React.FC<UploadAudioStepProps> = ({
  influencerId,
  onCountChange,
  audioError,
  setAudioError,
}) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  return (
    <div className={surveyStyles.field}>
      <div className={styles.uploadBox}>
        <div className={styles.header}>
          <div className={styles.title}>Upload Audio</div>
          <p className={styles.subtitle}>
            Upload your best clear audio. This is how your fans will hear your AI
            persona.
          </p>
        </div>

        <div className={styles.tips}>
          <div className={styles.tipsTitle}>Audio Tips</div>
          <ul className={styles.tipList}>
            <li className={`${styles.tip} ${styles.tipGood}`}>
              <img className={styles.tipIcon} src={iconCheckCircle} alt="" />
              Quiet room
            </li>
            <li className={`${styles.tip} ${styles.tipGood}`}>
              <img className={styles.tipIcon} src={iconCheckCircle} alt="" />
              Speak naturally
            </li>
            <li className={`${styles.tip} ${styles.tipBad}`}>
              <img className={styles.tipIcon} src={iconCross} alt="" />
              Background noise
            </li>
            <li className={`${styles.tip} ${styles.tipBad}`}>
              <img className={styles.tipIcon} src={iconCross} alt="" />
              Speakerphone
            </li>
            <li className={`${styles.tip} ${styles.tipBad}`}>
              <img className={styles.tipIcon} src={iconCross} alt="" />
              Bluetooth headsets
            </li>
          </ul>
        </div>

        <div className={styles.actionCard}>
          <div className={styles.actionCardTitle}>Get Started</div>
          <div className={styles.actionButtons}>
            <IconButton
              color="pink"
              leftIcon={<SvgPack.Voice />}
              text="Start Recording"
            />
            <NormalButton
              type="square"
              color="black"
              leftIcon={<SvgPack.UploadPhoto />}
              text="Upload your own"
              onClick={() => fileInputRef.current?.click()}
            />
          </div>
          <input
            ref={fileInputRef}
            className={styles.hiddenInput}
            type="file"
            accept="audio/*"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              setAudioError(null);
            }}
          />
        </div>
      </div>

      <div className={styles.managerWrapper}>
        <InfluencerAudioManager
          influencerId={influencerId}
          onCountChange={(count) => {
            onCountChange(count);
            if (count > 0) setAudioError(null);
          }}
        />
      </div>

      {audioError && <div className={surveyStyles.error}>{audioError}</div>}
    </div>
  );
};

export default UploadAudioStep;
