import React, { useEffect, useRef, useState, useCallback } from 'react';
import { apiClient } from '@/api/apis';
import { Endpoints } from '@/api/urls';
import surveyStyles from '../ProfileSurvey.module.css';
import styles from './UploadAudioStep.module.css';
import NormalButton from '@/ui/components/inputs/buttons/NormalButton';
import iconCheckCircle from '@/assets/svg/iconCheckCircle.svg';
import iconCross from '@/assets/svg/iconCross.svg';
import SvgPack from '@/utils/SvgPack';
import {
  getSupportedAudioFormat,
  isMediaRecorderSupported,
  isGetUserMediaSupported,
} from '../utils/fileUploadHelpers';
import { useFileUpload } from '@/hooks/survey/useFileUpload';
import {
  MIN_RECORDING_SECONDS,
  RECORDING_COUNTDOWN_SECONDS,
  ERROR_MESSAGES,
} from '../utils/constants';

interface AudioFile {
  key?: string;
  download_url: string;
}

interface AudioResponse {
  pre_influencer_id?: number | string;
  count?: number;
  files: AudioFile[];
}

interface UploadAudioStepProps {
  preInfluencerId: number | null;
  token: string;
  temp_password: string;
  audioError: string | null;
  onCountChange: (count: number) => void;
  onIsRecordingChange: (isRecording: boolean) => void;
  onErrorChange: (error: string | null) => void;
}

// Recording state machine
type RecordingState =
  | { status: 'idle' }
  | { status: 'countdown'; secondsLeft: number }
  | { status: 'recording'; elapsedSeconds: number }
  | { status: 'uploading' };

const UploadAudioStep: React.FC<UploadAudioStepProps> = ({
  preInfluencerId,
  token,
  temp_password,
  audioError,
  onCountChange,
  onIsRecordingChange,
  onErrorChange,
}) => {
  const [recordingState, setRecordingState] = useState<RecordingState>({ status: 'idle' });
  const [audioData, setAudioData] = useState<AudioResponse | null>(null);
  const [loadingList, setLoadingList] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const countdownRef = useRef<NodeJS.Timeout | null>(null);
  const intentionalStopRef = useRef<boolean>(false);

  const { uploadAudioFile, deleteAudioFile } = useFileUpload();

  useEffect(() => {
    const isBusy =
      recordingState.status === 'countdown' ||
      recordingState.status === 'recording' ||
      recordingState.status === 'uploading';
    onIsRecordingChange(isBusy);
  }, [recordingState.status, onIsRecordingChange]);

  useEffect(() => {
    return () => {
      if (recorderRef.current?.state === 'recording' || streamRef.current?.active) {
        cleanup();
      }
      if (timerRef.current) clearInterval(timerRef.current);
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, []);

  const cleanup = useCallback(() => {
    if (recorderRef.current && recorderRef.current.state !== 'inactive') {
      recorderRef.current.stop();
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
    }
    recorderRef.current = null;
    streamRef.current = null;
    chunksRef.current = [];
    intentionalStopRef.current = false;
  }, []);

  useEffect(() => {
    if (!preInfluencerId) {
      setAudioData({ pre_influencer_id: String(preInfluencerId), count: 0, files: [] });
      onCountChange(0);
      setLoadingList(false);
      return;
    }

    let canceled = false;

    const loadAudioFiles = async () => {
      try {
        setLoadingList(true);

        const response = await apiClient.get<AudioResponse>(
          Endpoints.pre_influencers.influencerAudio(preInfluencerId),
          {
            params: { token, temp_password },
          }
        );

        if (canceled) return;

        const files = response.data.files ?? [];
        const count = response.data.count ?? files.length ?? 0;

        setAudioData({ ...response.data, files, count });
        onCountChange(count);

        onErrorChange(null);
      } catch (error: any) {
        if (canceled) return;

        const detail = error?.response?.data?.detail;
        if (detail === 'Influencer has no audio file stored') {
          setAudioData({ pre_influencer_id: String(preInfluencerId), count: 0, files: [] });
          onCountChange(0);
          onErrorChange(null);
        } else {
          console.error('Failed to load audio files:', error);
          setAudioData(null);
          onCountChange(0);
          onErrorChange('Unable to load your audio. Please try again.');
        }
      } finally {
        if (!canceled) {
          setLoadingList(false);
        }
      }
    };

    void loadAudioFiles();

    return () => {
      canceled = true;
    };
  }, [preInfluencerId, token, temp_password, refreshKey, onCountChange, onErrorChange]);

  const startCountdown = useCallback(() => {
    if (!isGetUserMediaSupported() || !isMediaRecorderSupported()) {
      onErrorChange(ERROR_MESSAGES.AUDIO_NOT_SUPPORTED);
      return;
    }

    setRecordingState({ status: 'countdown', secondsLeft: RECORDING_COUNTDOWN_SECONDS });
    onErrorChange(null);

    let count = RECORDING_COUNTDOWN_SECONDS;
    countdownRef.current = setInterval(() => {
      count -= 1;
      if (count <= 0) {
        if (countdownRef.current) {
          clearInterval(countdownRef.current);
          countdownRef.current = null;
        }
        startRecording();
      } else {
        setRecordingState({ status: 'countdown', secondsLeft: count });
      }
    }, 1000);
  }, [onErrorChange]);

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const format = getSupportedAudioFormat();
      const recorder = format.mimeType
        ? new MediaRecorder(stream, { mimeType: format.mimeType })
        : new MediaRecorder(stream);

      recorderRef.current = recorder;
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      recorder.onstop = () => {
        if (intentionalStopRef.current) {
          handleRecordingComplete(format.mimeType, format.extension);
        } else {
          console.warn('Recording stopped unintentionally');
          setRecordingState({ status: 'idle' });
          cleanup();
        }
      };

      recorder.onerror = () => {
        onErrorChange(ERROR_MESSAGES.AUDIO_RECORDING_FAILED);
        setRecordingState({ status: 'idle' });
        onIsRecordingChange(false);
        intentionalStopRef.current = false;
        cleanup();
      };

      intentionalStopRef.current = false;
      recorder.start();
      setRecordingState({ status: 'recording', elapsedSeconds: 0 });
      onIsRecordingChange(true);

      const startTime = Date.now();
      timerRef.current = setInterval(() => {
        const elapsed = Math.floor((Date.now() - startTime) / 1000);
        setRecordingState({ status: 'recording', elapsedSeconds: elapsed });
      }, 1000);
    } catch (error: any) {
      console.error('Recording failed:', error);
      const errorName = error?.name || '';

      if (errorName === 'NotAllowedError' || errorName === 'NotFoundError') {
        onErrorChange(ERROR_MESSAGES.AUDIO_MIC_BLOCKED);
      } else {
        onErrorChange(ERROR_MESSAGES.AUDIO_MIC_UNAVAILABLE);
      }

      setRecordingState({ status: 'idle' });
      onIsRecordingChange(false);
      cleanup();
    }
  }, [cleanup, onErrorChange, onIsRecordingChange]);

  const stopRecording = useCallback(() => {
    if (recordingState.status !== 'recording') {
      return;
    }

    if (recordingState.elapsedSeconds < MIN_RECORDING_SECONDS) {
      onErrorChange(ERROR_MESSAGES.AUDIO_TOO_SHORT);
      onIsRecordingChange(false);
      setRecordingState({ status: 'idle' });
      intentionalStopRef.current = false;
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
      if (recorderRef.current && recorderRef.current.state !== 'inactive') {
        recorderRef.current.stop();
      }
      return;
    }

    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    intentionalStopRef.current = true;

    if (recorderRef.current && recorderRef.current.state !== 'inactive') {
      recorderRef.current.stop();
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    onIsRecordingChange(false);
  }, [recordingState, onErrorChange, onIsRecordingChange]);

  const handleRecordingComplete = useCallback(
    async (mimeType: string, extension: string) => {
      if (chunksRef.current.length === 0) {
        onErrorChange(ERROR_MESSAGES.AUDIO_NO_DATA);
        setRecordingState({ status: 'idle' });
        cleanup();
        return;
      }

      setRecordingState({ status: 'uploading' });

      try {
        const blob = new Blob(chunksRef.current, { type: mimeType || 'audio/webm' });

        if (blob.size < 1000) {
          onErrorChange(ERROR_MESSAGES.AUDIO_NO_DATA);
          setRecordingState({ status: 'idle' });
          cleanup();
          return;
        }

        const file = new File([blob], `recording-${Date.now()}.${extension}`, {
          type: mimeType || 'audio/webm',
        });

        if (!preInfluencerId) throw new Error('Missing pre-influencer ID');

        const result = await uploadAudioFile({
          file,
          preInfluencerId,
          token,
          temp_password,
        });

        if (!result.success) {
          throw new Error(result.error || ERROR_MESSAGES.AUDIO_UPLOAD_FAILED);
        }

        setLoadingList(true);
        setRefreshKey((n) => n + 1);
        onErrorChange(null);
        setRecordingState({ status: 'idle' });
      } catch (error) {
        console.error('Upload failed:', error);
        onErrorChange(ERROR_MESSAGES.AUDIO_UPLOAD_FAILED);
        setRecordingState({ status: 'idle' });
      } finally {
        cleanup();
      }
    },
    [
      preInfluencerId,
      token,
      temp_password,
      uploadAudioFile,
      cleanup,
      onErrorChange,
    ]
  );

  const handleDelete = useCallback(
    async (key: string) => {
      if (!window.confirm('Are you sure you want to delete this audio?')) {
        return;
      }

      if (!preInfluencerId) return;

      const result = await deleteAudioFile({ preInfluencerId, key, token, temp_password });

      if (result.success) {
        setAudioData((prev) => {
          if (!prev) return prev;
          const nextFiles = prev.files.filter((file) => file.key !== key);
          return {
            ...prev,
            files: nextFiles,
            count: nextFiles.length,
          };
        });
        setLoadingList(true);
        onCountChange(0);
        onErrorChange(null);
        setRefreshKey((n) => n + 1);
      } else {
        onErrorChange(result.error || ERROR_MESSAGES.AUDIO_DELETE_FAILED);
      }
    },
    [preInfluencerId, token, temp_password, deleteAudioFile, onErrorChange]
  );

  const files = audioData?.files ?? [];
  const filesNewestFirst = [...files].reverse();
  const isRecordingNow = recordingState.status === 'recording';
  const isCountdown = recordingState.status === 'countdown';
  const isUploading = recordingState.status === 'uploading';

  return (
    <div className={surveyStyles.field}>
      {!isRecordingNow && (
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
              <li className={`${styles.tip} ${styles.tipGood}`}>
                <img className={styles.tipIcon} src={iconCheckCircle} alt="" />
                15 seconds minimum
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
        {!isRecordingNow && (
          <>
            {isCountdown && recordingState.status === 'countdown' && (
              <div className={styles.statusPill}>
                <span className={styles.statusDot} />
                Starting in {recordingState.secondsLeft}…
              </div>
            )}

            {isUploading && (
              <div className={styles.statusPill}>
                <span className={styles.statusDot} />
                Uploading…
              </div>
            )}

            {!isCountdown && !isUploading && (
              <div className={styles.actionButtons}>
                <NormalButton
                  type="square"
                  color="pink"
                  leftIcon={<SvgPack.RecordingStart />}
                  text="Record Script"
                  className={surveyStyles.glassButton}
                  disabled={isUploading}
                  onClick={startCountdown}
                />
              </div>
            )}
          </>
        )}

        {isRecordingNow && recordingState.status === 'recording' && (
          <>
            <div className={styles.statusPill}>
              <span className={styles.statusDot} />
              Recording...
            </div>
            <div className={styles.title}>
              Please read the script below and stop recording after a minimum of 15 seconds.
            </div>

            <div className={styles.scriptBox}>
              <ul className={styles.scriptList}>
                <li>Hey, babe, I just got home from work. I thought about you all day.</li>
                <li>I miss you so much already. How was your morning?</li>
                <li>Did you drink your favorite coffee today?</li>
                <li>I keep thinking about your smile. It always makes my world feel bright.</li>
                <li>Do you remember our walk in the park last weekend?</li>
                <li>Holding your hand felt so perfect. I loved every second.</li>
                <li>What are your plans tonight? Maybe we can video call later?</li>
                <li>I love how your silly jokes always make me laugh.</li>
                <li>You really are my everything, babe.</li>
                <li>I can't wait to hear your voice again.</li>
                <li>Tell me, what are you doing right now?</li>
              </ul>
            </div>

            <div className={styles.subtitle}>
              Minimum recording: {MIN_RECORDING_SECONDS}s (Recorded: {recordingState.elapsedSeconds}s)
            </div>

            <div
              style={
                recordingState.elapsedSeconds < MIN_RECORDING_SECONDS
                  ? { pointerEvents: 'none' }
                  : undefined
              }
            >
              <NormalButton
                color="black"
                className={surveyStyles.glassButton}
                text={
                  recordingState.elapsedSeconds < MIN_RECORDING_SECONDS
                    ? `Keep recording (${Math.max(0, MIN_RECORDING_SECONDS - recordingState.elapsedSeconds)}s left)`
                    : 'Stop Recording'
                }
                leftIcon={<SvgPack.RecordingStop />}
                onClick={() => {
                  if (recordingState.elapsedSeconds < MIN_RECORDING_SECONDS) {
                    return;
                  }
                  stopRecording();
                }}
              />
            </div>
          </>
        )}
      </div>

      {!isRecordingNow && (
        <div className={surveyStyles.glassBox}>
          <div className={styles.reviewTitle}>
            {isUploading ? 'Uploading...' : 'Your Audio Samples'}
          </div>

          {loadingList && <div>Loading audio files…</div>}

          {!loadingList && files.length === 0 && !audioError && <div>No audio files uploaded yet.</div>}

          {!loadingList && filesNewestFirst.length > 0 && (
            <ul style={{ listStyle: 'none', padding: 0, margin: '16px 0 0' }}>
              {filesNewestFirst.map((file) => (
                <li
                  key={file.key ?? file.download_url}
                  style={{
                    padding: '12px 0',
                    borderBottom: '1px solid rgba(255,255,255,0.12)',
                  }}
                >
                  {file.key && (
                    <div style={{ fontSize: 14, marginBottom: 8 }}>{file.key}</div>
                  )}

                  <audio
                    controls
                    src={file.download_url}
                    style={{ width: '100%', marginBottom: 8 }}
                    onError={() => {
                      console.warn('Failed to preview audio file', file.key ?? file.download_url);
                    }}
                  />

                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      type="button"
                      onClick={() => window.open(file.download_url, '_blank')}
                      style={{
                        padding: '6px 12px',
                        borderRadius: 999,
                        border: '1px solid #fff',
                        background: 'transparent',
                        color: '#fff',
                        fontSize: 12,
                        cursor: 'pointer',
                      }}
                    >
                      Open
                    </button>

                    {file.key && (
                      <button
                        type="button"
                        onClick={() => handleDelete(file.key!)}
                        style={{
                          padding: '6px 12px',
                          borderRadius: 999,
                          border: '1px solid #f87171',
                          background: 'transparent',
                          color: '#fca5a5',
                          fontSize: 12,
                          cursor: 'pointer',
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

      {audioError && <div className={surveyStyles.error}>{audioError}</div>}
    </div>
  );
};

export default UploadAudioStep;
