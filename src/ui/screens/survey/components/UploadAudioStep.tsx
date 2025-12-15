import React, { useEffect, useRef, useState } from "react";
import axios from "axios";
import surveyStyles from "../ProfileSurvey.module.css";
import styles from "./UploadAudioStep.module.css";
import NormalButton from "@/ui/components/inputs/buttons/NormalButton";
import iconCheckCircle from "@/assets/svg/iconCheckCircle.svg";
import iconCross from "@/assets/svg/iconCross.svg";
import SvgPack from "@/utils/SvgPack";

interface UploadAudioStepProps {
  influencerId: string;
  onCountChange: (count: number) => void;
  audioError: string | null;
  setAudioError: (msg: string | null) => void;
  influencerName: string;
}

const UploadAudioStep: React.FC<UploadAudioStepProps> = ({
  influencerId,
  onCountChange,
  influencerName,
  audioError,
  setAudioError,
}) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [hasRecording, setHasRecording] = useState(false);
  const [uploadingOwn, setUploadingOwn] = useState(false);
  const [localAudioUrl, setLocalAudioUrl] = useState<string | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);

  useEffect(() => {
    return () => {
      if (localAudioUrl && localAudioUrl.startsWith("blob:")) {
        URL.revokeObjectURL(localAudioUrl);
      }
    };
  }, [localAudioUrl]);

  const handleUploadOwn = async (file: File) => {
    setUploadingOwn(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      await axios.post(
        `${import.meta.env.VITE_TEASE_ME_PROTOCOL}://${import.meta.env.VITE_TEASE_ME_HOST
        }/influencer/influencer-audio/${influencerId}`,
        formData,
        { headers: { "Content-Type": "multipart/form-data" } }
      );
      setHasRecording(true);
      setAudioError(null);
      onCountChange(1);
    } catch (err) {
      console.error("Error uploading audio", err);
      setAudioError("Failed to upload audio. Please try again.");
    } finally {
      setUploadingOwn(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const hasAudio = hasRecording || Boolean(localAudioUrl);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        if (localAudioUrl) URL.revokeObjectURL(localAudioUrl);
        const url = URL.createObjectURL(blob);
        setLocalAudioUrl(url);
        setHasRecording(true);
        setAudioError(null);

        const file = new File([blob], "recording.webm", { type: "audio/webm" });
        handleUploadOwn(file);
        stream.getTracks().forEach((t) => t.stop());
      };

      recorder.start();
      recorderRef.current = recorder;
      setIsRecording(true);
      setHasRecording(false);
    } catch (err) {
      console.error("Recording failed", err);
      setAudioError("Unable to access microphone. Check permissions.");
    }
  };

  const stopRecording = () => {
    if (recorderRef.current && isRecording) {
      recorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const name = influencerName || "your name";

  return (
    <div className={surveyStyles.field}>
      <div className={styles.header}>
        <div className={styles.title}>Upload Audio</div>
        <p className={styles.subtitle}>
          Upload your best clear audio. This is how your fans will hear your AI persona.
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

      <div className={surveyStyles.glassBox}>
        {!isRecording && (
          <>
            <div className={styles.reviewTitle}>Get Started</div>
            <div className={styles.actionButtons}>
              <NormalButton
                type="square"
                color="pink"
                leftIcon={<SvgPack.RecordingStart />}
                text="Record Script"
                className={surveyStyles.glassButton}
                onClick={startRecording}
              />
            </div>
          </>
        )}

        {isRecording && (
          <>
            <div className={styles.statusPill}>
              <span className={styles.statusDot} />
              Recording...
            </div>
            <div className={styles.title}>Recording...</div>
            <p className={styles.subtitle}>Please read the script below.</p>

            <div className={styles.scriptBox}>
              <p>Hello, my name is {name}, and I’m recording this sample for voice cloning.</p>
              <p>I speak in a calm and natural tone. The quick brown fox jumps over the lazy dog.</p>
              <p>Artificial intelligence is transforming the way we live, work, and communicate.</p>
              <p>In the morning, I enjoy coffee, while in the evening I might choose tea.</p>
              <p>Sometimes I speak softly, and other times I raise my voice for emphasis.</p>
              <p>Can you hear the difference in my tone, my pitch, and my rhythm?</p>
              <p>This recording should capture the natural flow of my everyday speech.</p>
              <p>Thank you for listening.</p>
            </div>

            <NormalButton
              color="black"
              className={surveyStyles.glassButton}
              text="Stop Recording"
              leftIcon={<SvgPack.RecordingStop />}
              onClick={stopRecording}
            />
          </>
        )}
      </div>

      {hasAudio && (
        <div className={surveyStyles.glassBox}>
          <div className={styles.reviewTitle}>Recording Complete!</div>
          {localAudioUrl && (
            <audio
              className={styles.audioPreview}
              controls
              src={localAudioUrl}
            />
          )}
          <div className={styles.dividerText}>Or</div>
          <NormalButton
            type="square"
            color="black"
            className={surveyStyles.glassButton}
            leftIcon={<SvgPack.UploadPhoto />}
            text={uploadingOwn ? "Uploading…" : "Upload your own"}
            onClick={() => !uploadingOwn && fileInputRef.current?.click()}
          />
        </div>
      )}

      <input
        ref={fileInputRef}
        className={styles.hiddenInput}
        type="file"
        accept="audio/*"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (!file) return;
          if (localAudioUrl) URL.revokeObjectURL(localAudioUrl);
          const objectUrl = URL.createObjectURL(file);
          setLocalAudioUrl(objectUrl);
          setHasRecording(true);
          setAudioError(null);
          onCountChange(1);
          handleUploadOwn(file);
        }}
      />

      {audioError && <div className={surveyStyles.error}>{audioError}</div>}
    </div>
  );
};

export default UploadAudioStep;
