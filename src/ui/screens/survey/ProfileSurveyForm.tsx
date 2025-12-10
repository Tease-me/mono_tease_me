import { apiClient } from "@/api/apis";
import { SURVEY_STEPS } from "@/utils/surveyConfig";
import React, { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import NormalButton from "@/ui/components/inputs/buttons/NormalButton";
import PrimaryButton from "@/ui/components/inputs/buttons/PrimaryButton";
import SvgPack from "@/utils/SvgPack";
import styles from "./ProfileSurvey.module.css";

//interface SurveyState {
//pre_influencer_id: number;
//survey_answers: Record<string, any>;
//survey_step: number;
//}

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

  useEffect(() => {
    const load = async () => {
      //if (!token) {
      // setLoadError("Invalid survey link.");
      //setLoading(false);
      //return;
      //}

      try {
        //const { data } = await apiClient.get<SurveyState>(
        //"/pre-influencers/survey",
        //{ params: { token } }
        //);

        const data = {
          pre_influencer_id: 9,
          survey_answers: {
            q1_name: "Glauco Martins Pereira",
            q2_email: "glauco.mjpro@gmail.com",
            q3_social_name: "dvxcv",
            q4_country: "xcvxc",
            q5_main_language: "xcv",
            q6_secondary_language: "cxvcxv",
            q7_at_parties: "talk_many",
            q8_after_talking: "energised",
            q9_make_friends: "very_fast",
            q10_focus_more_on: "now",
            q11_like_to_talk_about: "real_daily",
            q12_first_remember: "details",
            q13_when_someone_cries: "fix_problem",
            q14_decisions_with: "logic",
            q15_if_partner_wrong: "tell_directly",
            q16_daily_life_is: "planned",
            q17_you_like: "clean",
            q18_plan_date: "decide_exact",
            q19_you_are_more: "talkative",
            q20_care_more_about: "facts",
            q21_weekend_prefer: "stay_home",
            q22_rules_are: "important",
            q23_my_future: "clear_plan",
            q24_compliments_make_you: "shy",
            q25_when_friend_telling: "listen_story",
            q26_secrets: "keep_inside",
            q27_love_style: "actions",
            q28_when_annoying: "be_straight",
            q29_catchphrases: "sdfsdrf",
            q30_wakeup_time: "dsfsdf",
            q31_sleep_time: "sdfdsf",
            q32_must_do_morning: "sdfdsf",
            q33_must_do_night: "sdfdsf",
            q34_favorite_food: "sdfds",
            q35_favorite_food_type: "sdfsdf",
            q36_favorite_drink: "sdfdsf",
            q37_sweet_or_salty: "sweet",
            q38_favorite_snack: "sdfdsf",
            q39_favorite_color: "sdfsdf",
            q40_favorite_animal: "fsdfsdf",
            q41_favorite_season: "sdfdsf",
            q42_favorite_weather: "sdfdsf",
            q43_favorite_sport: "sdfdsf",
            q44_favorite_party_type: "sdfsdf",
            q45_favorite_movie_or_series: "sdfdsf",
            q46_favorite_song_now: "sdfdsf",
            q47_favorite_music_type: "sdfdsf",
            q48_what_do_when_bored: "sdfsdf",
            q49_favorite_app_or_game: "sdfsdf",
            q50_like_shopping: "yes",
            q51_what_do_you_shop_most: "sdfdsfsdf",
            q52_favorite_with_partner: "sdfsdf",
            q53_great_date: "sdfdsf",
            q54_favorite_date_place: "sdfdsf",
            q55_best_gift: "sdfsdf",
            q56_most_memorable_gift: "sdfsdf",
            q57_call_loved_ones: "sdfsf",
            q58_how_loved_ones_call_you: "sfddsfs",
            q59_makes_you_laugh: "sdfdsf",
            q60_makes_you_angry: "sdfdsf",
            q61_when_miss_someone: "sdfds",
            q62_biggest_dream: "sdfsdf",
          },
          survey_step: 0,
        };

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
      <div className={styles.outerframe}>
      <div className={styles.frame}>
        <div className={`${styles.card} ${styles.formCard}`}>
          <div className={styles.headerRow}>
            <div>
              <h2 className={styles.title}>{step.title}</h2>
            
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
                    {fieldErrors[q.id] && (
                      <div className={styles.error}>{fieldErrors[q.id]}</div>
                    )}
                    <InputTag
                      className={styles.input}
                      value={answers[q.id] || ""}
                      onChange={(
                        e: React.ChangeEvent<
                          HTMLInputElement | HTMLTextAreaElement
                        >
                      ) => updateAnswer(q.id, e.target.value)}
                    />
                   
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
                          <div className="">
                          <NormalButton
                            onClick={handleBack}
                            text="Back"
                             disabled={stepIndex === 0}
                            leftIcon={<SvgPack.ArrowLeft />}
                          />
                        </div>
                      <div className="tm-income-button-container">
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
      </div></div>
    </div>
  );
};

export default ProfileSurveyForm;
