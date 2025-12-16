import React, { useEffect, useRef, useState } from "react";
import { apiClient } from "@/api/apis";
import surveyStyles from "../ProfileSurvey.module.css";
import styles from "./UploadAudioStep.module.css";
import NormalButton from "@/ui/components/inputs/buttons/NormalButton";
import iconCheckCircle from "@/assets/svg/iconCheckCircle.svg";
import iconCross from "@/assets/svg/iconCross.svg";
import SvgPack from "@/utils/SvgPack";

interface UploadAudioStepProps {
  influencerId: string | number;
  token?: string;
  onCountChange: (count: number) => void;
  audioError: string | null;
  setAudioError: (msg: string | null) => void;
  influencerName: string;
}

const UploadAudioStep: React.FC<UploadAudioStepProps> = ({
  influencerId,
  token,
  onCountChange,
  influencerName,
  audioError,
  setAudioError,
}) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [uploadingOwn, setUploadingOwn] = useState(false);
  const [localAudioUrl, setLocalAudioUrl] = useState<string | null>(null);
  const [lastAction, setLastAction] = useState<"record" | "upload" | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const [refreshKey, setRefreshKey] = useState(0);
  const [initializing, setInitializing] = useState(true);
  const [hasLocalPending, setHasLocalPending] = useState(false);
  const stableAudioUrlRef = useRef<string | null>(null);
  const stableAudioBaseRef = useRef<string | null>(null);
  const audioUrlRef = useRef<string | null>(null);
  const isMediaRecorderSupported = typeof window !== "undefined" && "MediaRecorder" in window;
  const MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024; // 20MB safety cap

  const withCacheBust = (url: string) =>
    `${url}${url.includes("?") ? "&" : "?"}cb=${Date.now()}`;

  useEffect(() => {
    return () => {
      if (localAudioUrl && localAudioUrl.startsWith("blob:")) {
        URL.revokeObjectURL(localAudioUrl);
      }
      if (recorderRef.current && recorderRef.current.state !== "inactive") {
        recorderRef.current.stop();
      }
    };
  }, [localAudioUrl]);

  useEffect(() => {
    if (!influencerId) {
      setInitializing(false);
      return;
    }
    let canceled = false;
    const loadLatest = async () => {
      try {
        const res = await apiClient.get<{
          files: { download_url: string }[];
          count?: number;
        }>(`/influencer/influencer-audio/${influencerId}`, {
          params: token ? { token } : undefined,
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        });

        if (canceled) return;

        const latest = res.data.files?.[0];
        if (latest?.download_url && !hasLocalPending) {
          const base = latest.download_url.split("?")[0];
          // If we already have this file loaded, avoid swapping URLs (prevents player flicker)
          if (stableAudioBaseRef.current === base && localAudioUrl) {
            setInitializing(false);
            return;
          }
          const busted = withCacheBust(latest.download_url);
          setLocalAudioUrl((prev) => {
            if (prev && prev.startsWith("blob:") && prev !== busted) {
              URL.revokeObjectURL(prev);
            }
            audioUrlRef.current = busted;
            return busted;
          });
          stableAudioUrlRef.current = busted;
          stableAudioBaseRef.current = base;
          setLastAction((prev) => (prev === "record" ? "record" : "upload"));
          onCountChange(res.data.count ?? res.data.files.length ?? 1);
          setAudioError(null);
        } else if (latest?.download_url && hasLocalPending) {
          const base = latest.download_url.split("?")[0];
          if (stableAudioBaseRef.current === base && localAudioUrl) {
            setHasLocalPending(false);
            setAudioError(null);
            return;
          }
          const busted = withCacheBust(latest.download_url);
          setLocalAudioUrl((prev) => {
            if (prev && prev.startsWith("blob:") && prev !== busted) {
              URL.revokeObjectURL(prev);
            }
            audioUrlRef.current = busted;
            return busted;
          });
          stableAudioUrlRef.current = busted;
          stableAudioBaseRef.current = base;
          setLastAction((prev) => (prev === "record" ? "record" : "upload"));
          onCountChange(res.data.count ?? res.data.files.length ?? 1);
          setAudioError(null);
          setHasLocalPending(false);
        } else if (!latest && !hasLocalPending) {
          if (audioUrlRef.current && audioUrlRef.current.startsWith("blob:")) {
            URL.revokeObjectURL(audioUrlRef.current);
          }
          audioUrlRef.current = null;
          stableAudioUrlRef.current = null;
          setLocalAudioUrl(null);
          setLastAction(null);
          onCountChange(0);
        }
      } catch (err: any) {
        const detail = err?.response?.data?.detail;
        if (detail === "Influencer has no audio file stored") {
          onCountChange(0);
          setLocalAudioUrl(null);
          setLastAction(null);
          setAudioError(null);
        } else {
          console.error("Error fetching latest audio", err);
          setAudioError("Unable to load your audio. Please re-upload.");
        }
      }
      setInitializing(false);
    };

    loadLatest();
    return () => {
      canceled = true;
    };
  }, [influencerId, token, refreshKey, hasLocalPending, onCountChange]);

  const handleUploadOwn = async (file: File, origin: "upload" | "record" = "upload") => {
    if (!influencerId) {
      setAudioError("Missing influencer id.");
      return;
    }
    if (!file.type?.startsWith("audio/")) {
      setAudioError("Please upload an audio file.");
      return;
    }
    if (file.size > MAX_FILE_SIZE_BYTES) {
      setAudioError("Audio file is too large. Please upload under 20MB.");
      return;
    }
    onCountChange(0);
    setHasLocalPending(true);
    setUploadingOwn(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      await apiClient.post(
        `/influencer/influencer-audio/${influencerId}`,
        formData,
        {
          headers: {
            "Content-Type": "multipart/form-data",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          params: token ? { token } : undefined,
        }
      );
      setLastAction(origin);
      setAudioError(null);
      setHasLocalPending(false);
      onCountChange(1);
      setRefreshKey((n) => n + 1);
    } catch (err) {
      console.error("Error uploading audio", err);
      setAudioError("Failed to upload audio. Please try again.");
      const fallback = stableAudioUrlRef.current;
      if (fallback) {
        setLocalAudioUrl(fallback);
        setLastAction("upload");
        setHasLocalPending(false);
        audioUrlRef.current = fallback;
        onCountChange(1);
      } else {
        // keep the local preview so the user can retry or re-record
        setHasLocalPending(true);
        audioUrlRef.current = localAudioUrl;
        onCountChange(localAudioUrl ? 1 : 0);
      }
    } finally {
      setUploadingOwn(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const hasAudio = Boolean(localAudioUrl);

  const startRecording = async () => {
    if (isRecording) return;
    onCountChange(0);
    if (!navigator.mediaDevices?.getUserMedia || !isMediaRecorderSupported) {
      setAudioError("Recording not supported in this browser.");
      return;
    }
    try {
      if (!window.MediaRecorder) {
        setAudioError("Recording not supported in this browser.");
        return;
      }

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
        if (blob.size === 0) {
          setAudioError("No audio captured. Please try recording again.");
          setHasLocalPending(false);
          setIsRecording(false);
          return;
        }
        if (localAudioUrl) URL.revokeObjectURL(localAudioUrl);
        const url = URL.createObjectURL(blob);
        setLocalAudioUrl(url);
        audioUrlRef.current = url;
        setHasLocalPending(true);
        setLastAction("record");
        setAudioError(null);
        onCountChange(1);

        const file = new File([blob], "recording.webm", { type: "audio/webm" });
        handleUploadOwn(file, "record");
        stream.getTracks().forEach((t) => t.stop());
        setIsRecording(false);
      };

      recorder.start();
      recorderRef.current = recorder;
      setIsRecording(true);
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
      {!isRecording && !initializing && (
        <>
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
        </>
      )}

      <div className={surveyStyles.glassBox}>
        {!isRecording && !initializing && (
          <>
            {!hasAudio && <div className={styles.reviewTitle}>Get Started</div>}
            <div className={styles.actionButtons}>
              <NormalButton
                type="square"
                color="pink"
                leftIcon={<SvgPack.RecordingStart />}
                text={hasAudio ? "Record Again" : "Record Script"}
                className={surveyStyles.glassButton}
                disabled={uploadingOwn}
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
          <div className={styles.reviewTitle}>
            {uploadingOwn
              ? "Uploading..."
              : lastAction === "upload"
                ? "Upload Complete"
                : "Recording Complete"}
          </div>
          {localAudioUrl && (
            <audio
              className={styles.audioPreview}
              controls
              src={localAudioUrl}
onError={() => {
  setLastAction(null);
  setHasLocalPending(false);
  onCountChange(0);
  setAudioError("Audio failed to load. Please re-upload.");
}}

            />
          )}
          <div className={styles.dividerText}>Or</div>
          <NormalButton
            type="square"
            color="black"
            className={surveyStyles.glassButton}
            leftIcon={<SvgPack.Upload />}
            text={uploadingOwn ? "Uploading…" : "Upload your own"}
            disabled={isRecording || uploadingOwn}
            onClick={() => {
              if (isRecording || uploadingOwn) return;
              fileInputRef.current?.click();
            }}
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
          audioUrlRef.current = objectUrl;
          setHasLocalPending(true);
          setAudioError(null);
          onCountChange(0);
          handleUploadOwn(file, "upload");
        }}
      />

      {audioError && <div className={surveyStyles.error}>{audioError}</div>}
    </div>
  );
};

export default UploadAudioStep;
