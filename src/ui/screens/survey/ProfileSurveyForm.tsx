import { apiClient } from "@/api/apis";
import { SURVEY_STEPS } from "@/utils/surveyConfig";
import React, { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import styles from "./ProfileSurvey.module.css";

interface SurveyState {
  pre_influencer_id: number;
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
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [stepIndex, setStepIndex] = useState<number>(0);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string | null>>(
    {}
  );

  // 1) Carregar estado inicial pelo token
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

        setPreInfluencerId(data.pre_influencer_id);
        setAnswers(data.survey_answers || {});
        setStepIndex(data.survey_step || 0);
      } catch (err) {
        console.error(err);
        setLoadError("This survey link is invalid or expired.");
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [token]);

  // 2) Atualiza resposta local
  const updateAnswer = (key: string, value: any) => {
    setAnswers((prev) => ({
      ...prev,
      [key]: value,
    }));
    // limpa erro desse campo ao digitar
    setFieldErrors((prev) => ({ ...prev, [key]: null }));
  };

  // 3) Autosave no backend com debounce (para não perder nada)
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

  // 4) Validação dos campos obrigatórios do step atual
  const validateCurrentStep = (): boolean => {
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

  // 5) Save imediato quando clico Next/Finish (além do autosave)
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

  const step = SURVEY_STEPS[stepIndex];
  const isLastStep = stepIndex === SURVEY_STEPS.length - 1;

  const handleNext = async () => {
    const valid = validateCurrentStep();
    if (!valid) return;

    await saveNow();

    if (!isLastStep) {
      setStepIndex((i) => i + 1);
    } else {
      navigate("/thank-you");
    }
  };

  const handleBack = async () => {
    if (stepIndex === 0) return;
    // opcional: salvar antes de voltar
    await saveNow();
    setStepIndex((i) => Math.max(0, i - 1));
  };

  return (
    <div className={styles.screen}>
      <div className={styles.frame}>
        <div className={`${styles.card} ${styles.formCard}`}>
          <div className={styles.headerRow}>
            <div>
              <h2 className={styles.title}>{step.title}</h2>
              <p className={styles.subtitle}>
                Step {stepIndex + 1} of {SURVEY_STEPS.length}
              </p>
            </div>
            <span className={styles.saving}>
              {saving ? "Saving..." : "Saved"}
            </span>
          </div>

          <div className={styles.content}>
            {step.questions.map((q: SurveyQuestion) => {
              // text / textarea
              if (q.type === "text" || q.type === "textarea") {
                const InputTag: React.ElementType =
                  q.type === "textarea" ? "textarea" : "input";
                return (
                  <div key={q.id} className={styles.field}>
                    <label className={styles.label}>
                      {q.label}{" "}
                      {q.required && <span className={styles.required}>*</span>}
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
                      <div className={styles.error}>{fieldErrors[q.id]}</div>
                    )}
                  </div>
                );
              }

              // radio
              if (q.type === "radio") {
                return (
                  <div key={q.id} className={styles.field}>
                    <label className={styles.label}>
                      {q.label}{" "}
                      {q.required && <span className={styles.required}>*</span>}
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
                      <div className={styles.error}>{fieldErrors[q.id]}</div>
                    )}
                  </div>
                );
              }

              return null;
            })}
          </div>

          {/* BOTTOM BAR FIXA DENTRO DO CARD */}
          <div className={styles.bottomBar}>
            <div className={styles.stepInfo}>
              Step {stepIndex + 1} of {SURVEY_STEPS.length}
            </div>
            <div className={styles.buttonRow}>
              <button
                className={styles.btnOutline}
                disabled={stepIndex === 0}
                onClick={handleBack}
              >
                Back
              </button>
              <button className={styles.btnPrimary} onClick={handleNext}>
                {isLastStep ? "Finish" : "Next"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProfileSurveyForm;
