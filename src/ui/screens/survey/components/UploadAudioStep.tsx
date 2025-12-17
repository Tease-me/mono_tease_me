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
}

interface InfluencerAudioFile {
  key?: string;
  download_url: string;
}

interface InfluencerAudioResponse {
  influencer_id?: string;
  count?: number;
  files: InfluencerAudioFile[];
}

const UploadAudioStep: React.FC<UploadAudioStepProps> = ({
  influencerId,
  token,
  onCountChange,
  audioError,
  setAudioError,
}) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [uploadingOwn, setUploadingOwn] = useState(false);
  const [loadingList, setLoadingList] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const [audioData, setAudioData] = useState<InfluencerAudioResponse | null>(
    null
  );
  const [localAudioUrl, setLocalAudioUrl] = useState<string | null>(null);
  const [lastAction, setLastAction] = useState<"record" | "upload" | null>(
    null
  );
  const isMediaRecorderSupported =
    typeof window !== "undefined" && "MediaRecorder" in window;
  const MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024; // 20MB safety cap

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
      setAudioData({
        influencer_id: String(influencerId),
        count: 0,
        files: [],
      });
      onCountChange(0);
      setLoadingList(false);
      return;
    }
    let canceled = false;
    const loadAll = async () => {
      try {
        setLoadingList(true);

        const res = await apiClient.get<InfluencerAudioResponse>(
          `/influencer/influencer-audio/${influencerId}`,
          {
            params: token ? { token } : undefined,
          }
        );

        if (canceled) return;

        const files = res.data.files ?? [];
        const count = res.data.count ?? files.length ?? 0;
        setAudioData({ ...res.data, files, count });
        onCountChange(count);
        setAudioError(null);
      } catch (err: any) {
        if (canceled) return;

        const detail = err?.response?.data?.detail;
        if (detail === "Influencer has no audio file stored") {
          setAudioData({
            influencer_id: String(influencerId),
            count: 0,
            files: [],
          });
          onCountChange(0);
          setAudioError(null);
        } else {
          console.error("Error fetching audio files", err);
          setAudioError("Unable to load your audio. Please re-upload.");
        }
      } finally {
        if (!canceled) {
          setLoadingList(false);
        }
      }
    };

    void loadAll();
    return () => {
      canceled = true;
    };
  }, [influencerId, token, refreshKey]);

  const handleUploadOwn = async (
    file: File,
    origin: "upload" | "record" = "upload"
  ) => {
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

    setUploadingOwn(true);
    setAudioError(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      await apiClient.post(
        `/influencer/influencer-audio/${influencerId}`,
        formData,
        {
          headers: { "Content-Type": "multipart/form-data" },
          params: token ? { token } : undefined,
        }
      );
      setLastAction(origin);
      setRefreshKey((n) => n + 1);
    } catch (err) {
      console.error("Error uploading audio", err);
      setLastAction(null);
      setAudioError("Failed to upload audio. Please try again.");
    } finally {
      setUploadingOwn(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleDelete = async (key: string) => {
    if (!window.confirm("Are you sure you want to delete this audio?")) {
      return;
    }

    try {
      await apiClient.delete(`/pre-influencers/influencer-audio/${influencerId}`, {
        data: { key },
        params: token ? { token } : undefined,
      });
      setAudioError(null);
      setRefreshKey((n) => n + 1);
    } catch (err) {
      console.error("Error deleting audio file", err);
      setAudioError("Failed to delete audio. Please try again.");
    }
  };

  const hasUploadedAudio = (audioData?.files?.length ?? 0) > 0;
  const hasAudio = Boolean(localAudioUrl) || hasUploadedAudio;
  const files = audioData?.files ?? [];

  const startRecording = async () => {
    if (isRecording) return;
    if (!navigator.mediaDevices?.getUserMedia || !isMediaRecorderSupported) {
      setAudioError("Recording not supported in this browser.");
      return;
    }
    // reset recorder state up front so UI flips immediately
    setAudioError(null);
    setIsRecording(true);
    setLastAction(null);
    // stop any stale recorder/stream
    if (recorderRef.current && recorderRef.current.state !== "inactive") {
      recorderRef.current.stop();
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((t) => t.stop());
      mediaStreamRef.current = null;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;

      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        const noData = blob.size === 0 || chunksRef.current.length === 0;
        if (localAudioUrl && localAudioUrl.startsWith("blob:")) {
          URL.revokeObjectURL(localAudioUrl);
        }
        if (noData) {
          setAudioError("No audio captured. Please try recording again.");
        } else {
          const url = URL.createObjectURL(blob);
          setLocalAudioUrl(url);
          setAudioError(null);
          const file = new File([blob], "recording.webm", {
            type: "audio/webm",
          });
          handleUploadOwn(file, "record");
        }
        stream.getTracks().forEach((t) => t.stop());
        mediaStreamRef.current = null;
        setIsRecording(false);
      };

      recorder.onerror = () => {
        setAudioError("Recording failed. Please try again.");
        setIsRecording(false);
        stream.getTracks().forEach((t) => t.stop());
        mediaStreamRef.current = null;
      };

      recorder.start();
      recorderRef.current = recorder;
    } catch (err) {
      console.error("Recording failed", err);
      setAudioError("Unable to access microphone. Check permissions.");
      setIsRecording(false);
    }
  };

  const stopRecording = () => {
    if (recorderRef.current && recorderRef.current.state !== "inactive") {
      recorderRef.current.stop();
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((t) => t.stop());
      mediaStreamRef.current = null;
    }
  };

  return (
    <div className={surveyStyles.field}>
      {!isRecording && (
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
        {!isRecording && (
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
              <p>Hey, babe, I just got home from work. I thought about you all day.</p>
              <p>I miss you so much already. How was your morning?</p>
              <p>Did you drink your favorite coffee today?</p>
              <p>I keep thinking about your smile. It always makes my world feel bright.</p>
              <p>Do you remember our walk in the park last weekend?</p>
              <p>Holding your hand felt so perfect. I loved every second.</p>
              <p>What are your plans tonight? Maybe we can video call later?</p>
              <p>I love how your silly jokes always make me laugh.</p>
              <p>You really are my everything, babe.</p>
              <p>I can’t wait to hear your voice again.</p>
              <p>Tell me, what are you doing right now?</p>
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

      {!isRecording && (
        <div className={surveyStyles.glassBox}>
          <div className={styles.reviewTitle}>
            {uploadingOwn
              ? "Uploading..."
              : lastAction === "upload"
                ? "Upload Complete"
                : lastAction === "record"
                  ? "Recording Complete"
                  : "Your Audio Samples"}
          </div>
          {localAudioUrl && (
            <audio
              className={styles.audioPreview}
              controls
              src={localAudioUrl}
              onError={() => {
                setLastAction(null);
                setAudioError("Audio failed to load. Please re-upload.");
              }}
            />
          )}

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

          {loadingList && <div>Loading audio files…</div>}

          {!loadingList && files.length === 0 && (
            <div>No audio files uploaded yet.</div>
          )}

          {!loadingList && files.length > 0 && (
            <ul style={{ listStyle: "none", padding: 0, margin: "16px 0 0" }}>
              {files.map((file) => (
                <li
                  key={file.key ?? file.download_url}
                  style={{
                    padding: "12px 0",
                    borderBottom: "1px solid rgba(255,255,255,0.12)",
                  }}
                >
                  {file.key && (
                    <div style={{ fontSize: 14, marginBottom: 8 }}>
                      {file.key}
                    </div>
                  )}

                  <audio
                    controls
                    src={file.download_url}
                    style={{ width: "100%", marginBottom: 8 }}
                    onError={() =>
                      setAudioError(
                        "Audio failed to load. Please try re-uploading."
                      )
                    }
                  />

                  <div style={{ display: "flex", gap: 8 }}>
                    <button
                      type="button"
                      onClick={() => window.open(file.download_url, "_blank")}
                      style={{
                        padding: "6px 12px",
                        borderRadius: 999,
                        border: "1px solid #fff",
                        background: "transparent",
                        color: "#fff",
                        fontSize: 12,
                        cursor: "pointer",
                      }}
                    >
                      Open
                    </button>

                    {file.key && (
                      <button
                        type="button"
                        onClick={() => handleDelete(file.key!)}
                        style={{
                          padding: "6px 12px",
                          borderRadius: 999,
                          border: "1px solid #f87171",
                          background: "transparent",
                          color: "#fca5a5",
                          fontSize: 12,
                          cursor: "pointer",
                        }}
                      >
                        Delete
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
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
          if (localAudioUrl && localAudioUrl.startsWith("blob:")) {
            URL.revokeObjectURL(localAudioUrl);
          }
          const objectUrl = URL.createObjectURL(file);
          setLocalAudioUrl(objectUrl);
          setAudioError(null);
          handleUploadOwn(file, "upload");
        }}
      />

      {audioError && <div className={surveyStyles.error}>{audioError}</div>}
    </div>
  );
};

export default UploadAudioStep;
