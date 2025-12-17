import { apiClient } from "@/api/apis";
import NormalButton from "@/ui/components/inputs/buttons/NormalButton";
import PrimaryButton from "@/ui/components/inputs/buttons/PrimaryButton";
import { SURVEY_STEPS } from "@/utils/surveyConfig";
import SvgPack from "@/utils/SvgPack";
import React, { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import InfluencerAudioManager from "../influencer-audio-manager/InfluencerAudioManager";
import SocialMediaStep from "./components/SocialMediaStep";
import styles from "./ProfileSurvey.module.css";

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

const ProfileSurveyForm: React.FC = () => {
  const [params] = useSearchParams();
  const navigate = useNavigate();

  const token = params.get("token") || "";

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [preInfluencerId, setPreInfluencerId] = useState<number | null>(null);
  const [preInfluencerUsername, setPreInfluencerUsername] = useState<
    string | null
  >(null);

  const [audioCount, setAudioCount] = useState<number>(0);
  const [audioError, setAudioError] = useState<string | null>(null);

  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [stepIndex, setStepIndex] = useState<number>(0);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string | null>>(
    {}
  );
  const [uploadingPicture, setUploadingPicture] = useState(false);
  const [pictureError, setPictureError] = useState<string | null>(null);
  const [socialError, setSocialError] = useState<string | null>(null);
  const [pictureUrl, setPictureUrl] = useState<string | null>(null);
  const [instagramVerifying, setInstagramVerifying] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const surveyStepsCount = SURVEY_STEPS.length;
  const pictureStepIndex = surveyStepsCount;
  const socialsStepIndex = surveyStepsCount + 1;
  const audioStepIndex = surveyStepsCount + 2;
  const wizardTotalSteps = surveyStepsCount + 3;

  useEffect(() => {
    const load = async () => {
      if (!token) {
        setLoadError("Invalid survey link.");
        setLoading(false);
        return;
      }

      try {
        const { data } = await apiClient.get<SurveyState>(
          "/pre-influencers/survey",
          { params: { token } }
        );

        const safeStep = Math.min(data.survey_step || 0, wizardTotalSteps - 1);

        setPreInfluencerId(data.pre_influencer_id);
        setPreInfluencerUsername(data.username);
        setAnswers(data.survey_answers || {});
        setStepIndex(safeStep);
      } catch (err) {
        console.error(err);
        setLoadError("This survey link is invalid or expired.");
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [token, wizardTotalSteps]);

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
        });
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
        );
        setPictureUrl(data.url);
      } catch (err) {
        console.error("Error fetching picture URL", err);
        setPictureUrl(null);
      }
    };

    fetchUrl();
  }, [preInfluencerId, answers["profile_picture_key"]]);

  const handleVerifyInstagram = async () => {
    const raw = answers["social_instagram"];
    if (!raw || typeof raw !== "string") return;

    const username = raw.trim().replace(/^@/, "");
    if (!username) return;

    updateAnswer("social_instagram_verify_error", null);
    updateAnswer("social_instagram_verified", false);

    try {
      setInstagramVerifying(true);

      const { data } = await apiClient.get("/social/api/followers", {
        params: { service: "instagram", username },
      });

      if (!data?.success) {
        throw new Error("Provider returned success=false");
      }

      updateAnswer("social_instagram_followers", data.count ?? 0);
      updateAnswer("social_instagram_verified", true);
    } catch (err) {
      console.error("Error verifying Instagram:", err);
      updateAnswer(
        "social_instagram_verify_error",
        "Could not fetch followers right now. Please try again."
      );
    } finally {
      setInstagramVerifying(false);
    }
  };

  const validateSurveyStep = (): boolean => {
    const step = SURVEY_STEPS[stepIndex];
    const newErrors: Record<string, string> = {};

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
      });
    } catch (err) {
      console.error("Error saving survey (manual):", err);
    } finally {
      setSaving(false);
    }
  };

  const handleNext = async () => {
    let valid = true;

    if (stepIndex < surveyStepsCount) {
      valid = validateSurveyStep();
    } else if (stepIndex === pictureStepIndex) {
      valid = validatePictureStep();
    } else if (stepIndex === socialsStepIndex) {
      valid = validateSocialsStep();
    } else if (stepIndex === audioStepIndex) {
      valid = validateAudioStep();
    }

    if (!valid) return;

    await saveNow();

    if (stepIndex < wizardTotalSteps - 1) {
      setStepIndex((i) => i + 1);
    } else {
      navigate("/thank-you");
    }
  };

  const handleBack = async () => {
    if (stepIndex === 0) return;
    await saveNow();
    setStepIndex((i) => Math.max(0, i - 1));
  };

  const handlePictureSelect = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file || !preInfluencerId) return;

    setUploadingPicture(true);
    setPictureError(null);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("pre_influencer_id", String(preInfluencerId));

      const { data } = await apiClient.post(
        "/pre-influencers/upload-picture",
        formData,
        {
          headers: { "Content-Type": "multipart/form-data" },
        }
      );

      updateAnswer("profile_picture_key", data.s3_key);
    } catch (err) {
      console.error(err);
      setPictureError("Error uploading picture. Please try again.");
    } finally {
      setUploadingPicture(false);

      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  if (loading) {
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

  const currentSurveyStep =
    isSurveyStep && SURVEY_STEPS[stepIndex] ? SURVEY_STEPS[stepIndex] : null;

  const handleVerifyTwitter = async () => {
    const raw = answers["social_x"];
    if (!raw || typeof raw !== "string") return;

    const username = raw.trim().replace(/^@/, "");
    if (!username) return;

    updateAnswer("social_twitter_verify_error", null);
    updateAnswer("social_twitter_verified", false);

    try {
      setInstagramVerifying(true);

      const { data } = await apiClient.get("/social/api/followers", {
        params: {
          service: "twitter",
          username,
        },
      });

      if (!data?.success) {
        throw new Error("API returned success=false");
      }

      updateAnswer("social_twitter_followers", data.count ?? 0);
      updateAnswer("social_twitter_verified", true);
    } catch (err) {
      console.error(err);
      updateAnswer(
        "social_twitter_verify_error",
        "Could not fetch Twitter followers."
      );
    } finally {
      setInstagramVerifying(false);
    }
  };

  return (
    <div className={styles.screen}>
      <div className={styles.outerframe}>
        <div className={styles.frame}>
          <div className={`${styles.card} ${styles.formCard}`}>
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
              {/* STEPS DO FORM PDF */}
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
                <div className={styles.field}>
                  <label className={styles.label}>
                    Picture of influencer{" "}
                    <span className={styles.required}>*</span>
                  </label>
                  <p className={styles.subtitle}>
                    Upload a clear profile picture. This will be used in your
                    TeaseMe profile.
                  </p>
                  <input
                    ref={fileInputRef}
                    className={styles.input}
                    type="file"
                    accept="image/*"
                    onChange={handlePictureSelect}
                  />
                  {uploadingPicture && (
                    <div className={styles.subtitle}>Uploading…</div>
                  )}
                  {pictureUrl && !uploadingPicture && (
                    <div className={styles.picturePreviewWrapper}>
                      <div className={styles.subtitle}>Current picture:</div>
                      <img
                        src={pictureUrl}
                        alt="Influencer profile"
                        className={styles.picturePreview}
                      />
                    </div>
                  )}
                  {pictureError && (
                    <div className={styles.error}>{pictureError}</div>
                  )}
                </div>
              )}

              {/* STEP: SOCIAL MEDIA */}
              {isSocialsStep && (
                <SocialMediaStep
                  answers={answers}
                  updateAnswer={updateAnswer}
                  socialError={socialError}
                  onVerifyInstagram={handleVerifyInstagram}
                  onVerifyTwitter={handleVerifyTwitter}
                  instagramVerifying={instagramVerifying}
                />
              )}

              {/* STEP: AUDIO */}
              {isAudioStep && preInfluencerUsername && (
                <div className={styles.field}>
                  <label className={styles.label}>
                    Voice & Audio Samples{" "}
                    <span className={styles.required}>*</span>
                  </label>
                  <p className={styles.subtitle}>
                    Upload at least one audio sample so fans can hear how you
                    sound.
                  </p>

                  <div className={styles.audioWrapper}>
                    <InfluencerAudioManager
                      influencerId={preInfluencerUsername}
                      onCountChange={(count) => {
                        setAudioCount(count);
                        setAudioError(null);
                        updateAnswer("audio_count", count);
                      }}
                    />
                  </div>

                  {audioError && (
                    <div className={styles.error}>{audioError}</div>
                  )}
                </div>
              )}
            </div>

            {/* BOTTOM BAR */}
            <div className={styles.bottomBar}>
              <div className={styles.stepInfo}>
                Step {stepIndex + 1} of {wizardTotalSteps}
              </div>
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
                  <PrimaryButton
                    onClick={handleNext}
                    text={isLastStep ? "Finish" : "Next"}
                    rightIcon={<SvgPack.ArrowRight />}
                  />
                </div>
              </div>
            </div>

            <div className={styles.spacerSurvey}></div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProfileSurveyForm;
