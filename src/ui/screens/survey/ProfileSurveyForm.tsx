import { apiClient } from "@/api/apis";
import NormalButton from "@/ui/components/inputs/buttons/NormalButton";
import PrimaryButton from "@/ui/components/inputs/buttons/PrimaryButton";
import SvgPack from "@/utils/SvgPack";
import React, { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import SocialMediaStep from "./components/SocialMediaStep";
import styles from "./ProfileSurvey.module.css";
import UploadPictureStep from "./components/UploadPictureStep";
import UploadAudioStep from "./components/UploadAudioStep";
import { TermsModal } from "./components/TermsConditions";


interface SurveyState {
  pre_influencer_id: number;
  username: string;
  survey_answers: Record<string, any>;
  survey_step: number;
}

interface SurveyRadioOption {
  value: string | number;
  label: string;
}

interface SurveyQuestion {
  id: string;
  label: string;
  type: "text" | "textarea" | "radio";
  required?: boolean;
  options?: SurveyRadioOption[];
}

interface SurveyStep {
  id: string;
  title: string;
  questions: SurveyQuestion[];
}

const ProfileSurveyForm: React.FC = () => {
  const [params] = useSearchParams();

  const token = params.get("token") || "";
  const temp_password = params.get("temp_password") || "";
  const contentRef = useRef<HTMLDivElement | null>(null);

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [surveySteps, setSurveySteps] = useState<SurveyStep[]>([]);
  const [surveyStepsLoading, setSurveyStepsLoading] = useState(true);

  const [preInfluencerId, setPreInfluencerId] = useState<number | null>(null);
  const [preInfluencerUsername, setPreInfluencerUsername] = useState<
    string | null
  >(null);

  const [audioCount, setAudioCount] = useState<number>(0);
  const [audioHasRecorded, setAudioHasRecorded] = useState<boolean>(false);
  const [audioIsRecording, setAudioIsRecording] = useState<boolean>(false);
  const [audioError, setAudioError] = useState<string | null>(null);
  const [showTerms, setShowTerms] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [acceptingTerms, setAcceptingTerms] = useState(false);
  const [termsError, setTermsError] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [stepIndex, setStepIndex] = useState<number>(0);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string | null>>(
    {}
  );
  const [uploadingPicture, setUploadingPicture] = useState(false);
  const [pictureError, setPictureError] = useState<string | null>(null);
  const [isCropOpen, setIsCropOpen] = useState(false);
  const [cropImageSrc, setCropImageSrc] = useState<string | null>(null);
  const pendingFileRef = useRef<File | null>(null);
  const [pendingPictureKey, setPendingPictureKey] = useState<string | null>(null);
  const [pictureUrl, setPictureUrl] = useState<string | null>(null);
  const [socialError, setSocialError] = useState<string | null>(null);
  const [verifyingSocial, setVerifyingSocial] = useState<Record<string, boolean>>({});

  const objectUrlRef = useRef<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const surveyStepsCount = surveySteps.length;
  const pictureStepIndex = surveyStepsCount;
  const socialsStepIndex = surveyStepsCount + 1;
  const audioStepIndex = surveyStepsCount + 2;
  const wizardTotalSteps = surveyStepsCount + 3;

  const navigate = useNavigate();

  const scrollToTop = () => {
    const el = contentRef.current;
    if (el) el.scrollTo({ top: 0, behavior: "smooth" });
    else window.scrollTo({ top: 0, behavior: "smooth" });
  };


  useEffect(() => {
    const load = async () => {
      if (!token) {
        setLoadError("Invalid survey link.");
        setLoading(false);
        setSurveyStepsLoading(false);
        return;
      }

      try {
        const [{ data }, questionsResponse] = await Promise.all([
          apiClient.get<SurveyState>("/pre-influencers/survey", {
            params: { token, temp_password },
          }),
          apiClient.get("/pre-influencers/survey/questions", {
            params: { token, temp_password },
          }),
        ]);

        const questionsData = questionsResponse.data;
        const fetchedSteps: SurveyStep[] = Array.isArray(questionsData)
          ? questionsData
          : Array.isArray(questionsData?.sections)
            ? questionsData.sections
            : Array.isArray(questionsData?.steps)
              ? questionsData.steps
              : [];

        if (!fetchedSteps.length) {
          throw new Error("No survey questions returned.");
        }

        setSurveySteps(fetchedSteps);

        const totalSteps = fetchedSteps.length + 3;
        const safeStep = Math.min(data.survey_step || 0, totalSteps - 1);

        setPreInfluencerId(data.pre_influencer_id);
        setPreInfluencerUsername(data.username);
        setAnswers(data.survey_answers || {});
        setTermsAccepted(
          Boolean(
            data.survey_answers?.terms_agreement ?? data.survey_answers?.terms_accepted
          )
        );
        setStepIndex(safeStep);
      } catch (err) {
        console.error(err);
        setLoadError("This survey link is invalid or expired.");
      } finally {
        setLoading(false);
        setSurveyStepsLoading(false);
      }
    };

    load();
  }, [token]);

  const updateAnswer = (key: string, value: any) => {
    setAnswers((prev) => ({
      ...prev,
      [key]: value,
    }));
    setFieldErrors((prev) => ({ ...prev, [key]: null }));
  };

  useEffect(() => {
    if (!preInfluencerId) return;
    if (loading) return;

    const timeout = setTimeout(async () => {
      try {
        setSaving(true);
        await apiClient.put(`/pre-influencers/${preInfluencerId}/survey`, {
          survey_answers: answers,
          survey_step: stepIndex,
        }, { params: { token, temp_password } });
      } catch (err) {
        console.error("Error saving survey:", err);
      } finally {
        setSaving(false);
      }
    }, 800);

    return () => clearTimeout(timeout);
  }, [answers, stepIndex, preInfluencerId, loading]);

  useEffect(() => {
    if (!preInfluencerId) return;

    const key = answers["profile_picture_key"];
    if (!key) {
      setPictureUrl(null);
      return;
    }

    const fetchUrl = async () => {
      try {
        const { data } = await apiClient.get<{ url: string }>(
          `/pre-influencers/${preInfluencerId}/picture-url`
          , { params: { token, temp_password } });
        setPictureUrl(data.url);
        if (objectUrlRef.current) {
          URL.revokeObjectURL(objectUrlRef.current);
          objectUrlRef.current = null;
        }
      } catch (err) {
        console.error("Error fetching picture URL", err);
        setPictureUrl(null);
      }
    };

    // If we just uploaded and are showing a local blob for this key, delay
    if (
      pendingPictureKey &&
      pendingPictureKey === key &&
      (pictureUrl?.startsWith("blob:") || pictureUrl?.startsWith("data:"))
    ) {
      return;
    }

    fetchUrl();
  }, [preInfluencerId, answers["profile_picture_key"], pendingPictureKey, pictureUrl]);

  useEffect(() => {
    if (!pendingPictureKey) return;
    const timeout = setTimeout(() => setPendingPictureKey(null), 1500);
    return () => clearTimeout(timeout);
  }, [pendingPictureKey]);

  useEffect(() => {
    return () => {
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
      }
    };
  }, []);

  const handleVerifySocial = async (platform: string, handle: string) => {
    const cleanHandle = (handle || "").trim().replace(/^@/, "");
    if (!cleanHandle) return;

    const handleKey = `social_${platform}`;
    const followerKey = `social_${platform}_followers`;
    const verifiedKey = `social_${platform}_verified`;
    const errorKey = `social_${platform}_verify_error`;

    updateAnswer(errorKey, null);
    updateAnswer(verifiedKey, false);

    setVerifyingSocial((prev) => ({ ...prev, [platform]: true }));

    try {
      const serviceMap: Record<string, string> = {
        instagram: "instagram",
        x: "twitter",
      };
      const service = serviceMap[platform] || platform;

      const { data } = await apiClient.get("/social/api/followers", {
        params: { service, username: cleanHandle },
      });

      if (!data?.success) {
        throw new Error("Provider returned success=false");
      }

      updateAnswer(handleKey, data.username ?? cleanHandle);
      updateAnswer(followerKey, data.count ?? null);
      updateAnswer(verifiedKey, true);
    } catch (err: any) {
      console.error("Error verifying social", err);
      const backendMsg = err?.response?.data?.detail;
      const msg = Array.isArray(backendMsg)
        ? backendMsg.map((d: any) => d?.msg).filter(Boolean).join(" ")
        : backendMsg || "Connection failed. Please enter manually.";

      updateAnswer(errorKey, msg);
      updateAnswer(verifiedKey, false);
    } finally {
      setVerifyingSocial((prev) => ({ ...prev, [platform]: false }));
    }
  };

  const validateSurveyStep = (): boolean => {
    const step = surveySteps[stepIndex];
    const newErrors: Record<string, string> = {};

    if (!step) {
      setFieldErrors(newErrors);
      return false;
    }

    step.questions.forEach((q: SurveyQuestion) => {
      if (!q.required) return;

      const value = answers[q.id];
      const isEmpty =
        value === undefined ||
        value === null ||
        (typeof value === "string" && value.trim() === "");

      if (isEmpty) {
        newErrors[q.id] = "This field is required";
      }
    });

    setFieldErrors((prev) => ({ ...prev, ...newErrors }));
    return Object.keys(newErrors).length === 0;
  };

  const validatePictureStep = (): boolean => {
    setPictureError(null);
    const key = answers["profile_picture_key"];
    if (!key || typeof key !== "string" || !key.trim()) {
      setPictureError("Please upload a profile picture before continuing.");
      return false;
    }
    return true;
  };

  const validateSocialsStep = (): boolean => {
    setSocialError(null);

    const handles = [
      answers["social_instagram"],
      answers["social_tiktok"],
      answers["social_onlyfans"],
      answers["social_snapchat"],
      answers["social_x"],
      answers["social_telegram"],
      answers["social_whatsapp"],
    ];

    const hasAtLeastOne =
      handles.filter((h) => typeof h === "string" && h.trim().length > 0)
        .length > 0;

    if (!hasAtLeastOne) {
      setSocialError("Please add at least one social media handle.");
      return false;
    }
    return true;
  };

  const validateAudioStep = (): boolean => {
    setAudioError(null);
    if (audioCount <= 0) {
      setAudioError("Please upload at least one audio sample.");
      return false;
    }
    return true;
  };

  // Save explicitly on Next/Back
  const saveNow = async () => {
    if (!preInfluencerId) return;
    try {
      setSaving(true);
      await apiClient.put(`/pre-influencers/${preInfluencerId}/survey`, {
        survey_answers: answers,
        survey_step: stepIndex,
        token: token,
        temp_password: temp_password,
      });
    } catch (err) {
      console.error("Error saving survey (manual):", err);
    } finally {
      setSaving(false);
    }
  };

  const handleAcceptTerms = async () => {
    if (!preInfluencerId) return;
    try {
      setAcceptingTerms(true);
      setTermsError(null);
      await apiClient.post(
        `/pre-influencers/${preInfluencerId}/accept-terms`,
        { terms_agreement: true },
        {
          params: token ? { token } : undefined,
        }
      );
      setTermsAccepted(true);
      updateAnswer("terms_agreement", true);
      await saveNow();
      setShowTerms(false);
      navigate("/thank-you");
    } catch (err) {
      console.error("Error accepting terms", err);
      setTermsError("Failed to record acceptance. Please try again.");
    } finally {
      setAcceptingTerms(false);
    }
  };

  const handleNext = async () => {
    let valid = true;

    if (stepIndex < surveyStepsCount) {
      valid = validateSurveyStep();
    }
    else if (stepIndex === pictureStepIndex) {
      valid = validatePictureStep();
    } else if (stepIndex === socialsStepIndex) {
      valid = validateSocialsStep();
    } else if (stepIndex === audioStepIndex) {
      valid = validateAudioStep();
    }

    if (!valid) return;
    if (isLastStep && !termsAccepted) {
      setTermsError(null);
      setShowTerms(true);
      return;
    }


    await saveNow();

    if (stepIndex < wizardTotalSteps - 1) {
      setStepIndex((i) => i + 1);
      requestAnimationFrame(scrollToTop);
    } else {
      navigate("/thank-you");
    }


  };

  const handleBack = async () => {
    if (stepIndex === 0) return;
    await saveNow();
    setStepIndex((i) => Math.max(0, i - 1));
    requestAnimationFrame(scrollToTop);
  };

  const handlePictureSelect = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file || !preInfluencerId) return;
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
    }
    const localUrl = URL.createObjectURL(file);
    objectUrlRef.current = localUrl;

    pendingFileRef.current = file;
    setCropImageSrc(localUrl);
    setIsCropOpen(true);
    setPictureError(null);
  };

  const handleCloseCrop = () => {
    setIsCropOpen(false);
    setCropImageSrc(null);
    pendingFileRef.current = null;
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleCropComplete = async (blob: Blob, dataUrl: string) => {
    if (!preInfluencerId) return;
    setIsCropOpen(false);
    setCropImageSrc(null);
    setPictureUrl(dataUrl);
    setUploadingPicture(true);
    setPictureError(null);

    try {
      const originalFile = pendingFileRef.current;
      const fileName = originalFile?.name || "profile.jpg";
      const fileType = blob.type || originalFile?.type || "image/jpeg";
      const croppedFile = new File([blob], fileName, { type: fileType });

      const formData = new FormData();
      formData.append("file", croppedFile);
      formData.append("pre_influencer_id", String(preInfluencerId));

      const { data } = await apiClient.post(
        "/pre-influencers/upload-picture",
        formData,
        {
          params: { token, temp_password },
          headers: { "Content-Type": "multipart/form-data" },
        }
      );

      updateAnswer("profile_picture_key", data.s3_key);
      setPendingPictureKey(data.s3_key);
    } catch (err) {
      console.error(err);
      setPictureError("Error uploading picture. Please try again.");
    } finally {
      setUploadingPicture(false);
      pendingFileRef.current = null;
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
        objectUrlRef.current = null;
      }
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  if (loading || surveyStepsLoading) {
    return (
      <div className={styles.screen}>
        <div className={styles.frame}>
          <div className={styles.card}>Loading survey...</div>
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className={styles.screen}>
        <div className={styles.frame}>
          <div className={styles.card}>
            <p className={`${styles.error} ${styles.errorGeneral}`}>
              {loadError}
            </p>
          </div>
        </div>
      </div>
    );
  }

  const isSurveyStep = stepIndex < surveyStepsCount;
  const isPictureStep = stepIndex === pictureStepIndex;
  const isSocialsStep = stepIndex === socialsStepIndex;
  const isAudioStep = stepIndex === audioStepIndex;
  const isLastStep = stepIndex === wizardTotalSteps - 1;
  const isAudioInvalid = isAudioStep && (!audioHasRecorded || audioCount <= 0);


  const currentSurveyStep =
    isSurveyStep && surveySteps[stepIndex] ? surveySteps[stepIndex] : null;
  return (
    <div className={styles.screen}>
      <TermsModal
        isOpen={showTerms}
        onClose={() => setShowTerms(false)}
        onAccept={handleAcceptTerms}
        accepting={acceptingTerms}
        error={termsError}
      />
      <div className={styles.outerframe}>
        <div className={styles.frame}>
          <div className={`${styles.card} ${styles.formCard}`} ref={contentRef}>
            <div className={styles.headerRow}>
              <div>
                <h2 className={styles.title}>
                  {isSurveyStep && currentSurveyStep
                    ? currentSurveyStep.title
                    : isPictureStep
                      ? "Upload Your Picture"
                      : isSocialsStep
                        ? "Add Your Social Media"
                        : isAudioStep
                          ? "Upload Your Audio"
                          : "Profile Survey"}
                </h2>
                <p className={styles.subtitle}>
                  Step {stepIndex + 1} of {wizardTotalSteps}
                </p>
              </div>
              <span className={styles.saving}>
                {saving ? "Saving..." : "Saved"}
              </span>
            </div>

            <div className={styles.content}>
              {isSurveyStep &&
                currentSurveyStep &&
                currentSurveyStep.questions.map((q: SurveyQuestion) => {
                  if (q.type === "text" || q.type === "textarea") {
                    const InputTag: React.ElementType =
                      q.type === "textarea" ? "textarea" : "input";
                    return (
                      <div key={q.id} className={styles.field}>
                        <label className={styles.label}>
                          {q.label}{" "}
                          {q.required && (
                            <span className={styles.required}>*</span>
                          )}
                        </label>
                        <InputTag
                          className={styles.input}
                          value={answers[q.id] || ""}
                          onChange={(
                            e: React.ChangeEvent<
                              HTMLInputElement | HTMLTextAreaElement
                            >
                          ) => updateAnswer(q.id, e.target.value)}
                        />
                        {fieldErrors[q.id] && (
                          <div className={styles.error}>
                            {fieldErrors[q.id]}
                          </div>
                        )}
                      </div>
                    );
                  }

                  if (q.type === "radio") {
                    return (
                      <div key={q.id} className={styles.field}>
                        <label className={styles.label}>
                          {q.label}{" "}
                          {q.required && (
                            <span className={styles.required}>*</span>
                          )}
                        </label>
                        <div className={styles.radioGroup}>
                          {q.options?.map((opt: SurveyRadioOption) => (
                            <label key={opt.value}>
                              <input
                                type="radio"
                                name={q.id}
                                checked={answers[q.id] === opt.value}
                                onChange={() => updateAnswer(q.id, opt.value)}
                              />
                              {opt.label}
                            </label>
                          ))}
                        </div>
                        {fieldErrors[q.id] && (
                          <div className={styles.error}>
                            {fieldErrors[q.id]}
                          </div>
                        )}
                      </div>
                    );
                  }

                  return null;
                })}

              {/* STEP: PICTURE */}
              {isPictureStep && (
                <UploadPictureStep
                  uploading={uploadingPicture}
                  pictureUrl={pictureUrl}
                  pictureError={pictureError}
                  onSelect={handlePictureSelect}
                  inputRef={fileInputRef}
                  name={preInfluencerUsername || ""}
                  isCropOpen={isCropOpen}
                  cropImageSrc={cropImageSrc}
                  onCropClose={handleCloseCrop}
                  onCropComplete={handleCropComplete}
                />
              )}

              {/* STEP: SOCIAL MEDIA */}
              {isSocialsStep && (
                <SocialMediaStep
                  answers={answers}
                  updateAnswer={updateAnswer}
                  socialError={socialError}
                  onVerifySocial={handleVerifySocial}
                  verifyingSocial={verifyingSocial}
                />
              )}

              {/* STEP: AUDIO */}
              {isAudioStep && preInfluencerId && (
                <UploadAudioStep
                  influencerId={preInfluencerId}
                  token={token}
                  temp_password={temp_password}
                  onCountChange={(count) => {
                    setAudioCount(count);
                    setAudioError(null);
                    updateAnswer("audio_count", count);
                  }}
                  onRecordingChange={(recording) => setAudioIsRecording(recording)}
                  onRecorded={(hasRecorded) => setAudioHasRecorded(hasRecorded)}
                  audioError={audioError}
                  setAudioError={setAudioError}
                />
              )}
            </div>

            {/* BOTTOM BAR */}
            <div className={styles.bottomBar}>

              {/*<div className={styles.stepInfo}>
                Step {stepIndex + 1} of {wizardTotalSteps}
              </div>*/}

              {!audioIsRecording && (
                <div className={styles.buttonRow}>
                  <div>
                    <NormalButton
                      onClick={handleBack}
                      text="Back"
                      disabled={stepIndex === 0}
                      leftIcon={<SvgPack.ArrowLeft />}
                    />
                  </div>
                  <div>
                    {!isAudioInvalid && (
                      <PrimaryButton
                        onClick={handleNext}
                        text={isLastStep ? "Finish" : "Next"}
                        rightIcon={<SvgPack.ArrowRight />}
                      />
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className={styles.spacerSurvey}></div>

          </div>
        </div>
      </div>
    </div>
  );
};

export default ProfileSurveyForm;
