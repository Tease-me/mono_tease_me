import { useState, useCallback, useEffect, useRef } from 'react';
import { apiClient } from '@/api/apis';
import { Endpoints } from '@/api/urls';
import { SurveyStep } from '@/ui/screens/influencer-survey/validation/surveyValidation';
import { useAutoSave } from './useAutoSave';
import { ERROR_MESSAGES } from '@/ui/screens/influencer-survey/utils/constants';
import {
  buildSurveySaveBody,
  normalizeLoadedSurveyAnswers,
} from '@/ui/screens/influencer-survey/utils/surveyAnswers';

const HIDDEN_SURVEY_QUESTION_IDS = new Set(['q_about_me']);

function filterSurveySteps(steps: SurveyStep[]): SurveyStep[] {
  return steps
    .map((step) => ({
      ...step,
      questions: step.questions.filter(
        (question) => !HIDDEN_SURVEY_QUESTION_IDS.has(question.id),
      ),
    }))
    .filter((step) => step.questions.length > 0);
}

interface SurveyState {
  pre_influencer_id: number;
  username: string;
  survey_answers: Record<string, any>;
  survey_step: number;
}

export interface UseSurveyFormState {
  preInfluencerId: number | null;
  preInfluencerUsername: string | null;
  answers: Record<string, any>;
  currentStep: number;
  surveySteps: SurveyStep[];
  isLoading: boolean;
  loadError: string | null;
  isSaving: boolean;
  isDirty: boolean;
  pictureUrl: string | null;
  pictureKey: string | null;
  uploadingPicture: boolean;
  pictureError: string | null;
  isCropOpen: boolean;
  cropImageSrc: string | null;

  // Audio state
  audioCount: number;
  audioIsRecording: boolean;
  audioError: string | null;

  // Social state
  socialError: string | null;
  verifyingSocial: Record<string, boolean>;

  // Terms state
  showTermsModal: boolean;
  termsAccepted: boolean;
  acceptingTerms: boolean;
  termsError: string | null;


  // Validation
  fieldErrors: Record<string, string>;

  // Step indices
  surveyStepsCount: number;
  pictureStepIndex: number;
  socialStepIndex: number;
  audioStepIndex: number;
  assetStepIndex: number;
  totalSteps: number;
}

interface UseSurveyFormActions {
  // Answer management
  updateAnswer: (key: string, value: any) => void;

  // Navigation
  goToNextStep: () => void;
  goToPreviousStep: () => void;
  setCurrentStep: (step: number) => void;

  // Picture
  setPictureUrl: (url: string | null) => void;
  setPictureKey: (key: string | null) => void;
  setUploadingPicture: (uploading: boolean) => void;
  setPictureError: (error: string | null) => void;
  setIsCropOpen: (open: boolean) => void;
  setCropImageSrc: (src: string | null) => void;

  // Audio
  setAudioCount: (count: number) => void;
  setAudioIsRecording: (isRecording: boolean) => void;
  setAudioError: (error: string | null) => void;

  // Social
  setSocialError: (error: string | null) => void;
  setVerifyingSocial: (platform: string, verifying: boolean) => void;

  // Terms
  setShowTermsModal: (show: boolean) => void;
  setTermsAccepted: (accepted: boolean) => void;
  setAcceptingTerms: (accepting: boolean) => void;
  setTermsError: (error: string | null) => void;


  // Validation
  setFieldErrors: (errors: Record<string, string>) => void;
  clearFieldError: (key: string) => void;

  // Save
  saveNow: () => Promise<void>;
  /** Persist survey immediately after photo/audio upload (optional answer patch). */
  persistSurvey: (patch?: Record<string, any>) => Promise<void>;
}

interface UseSurveyFormParams {
  token: string;
  temp_password: string;
  startStep?: string;
}

export function useSurveyForm({
  token,
  temp_password,
  startStep,
}: UseSurveyFormParams): [UseSurveyFormState, UseSurveyFormActions] {
  const [preInfluencerId, setPreInfluencerId] = useState<number | null>(null);
  const [preInfluencerUsername, setPreInfluencerUsername] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [currentStep, setCurrentStep] = useState<number>(0);
  const [surveySteps, setSurveySteps] = useState<SurveyStep[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [pictureUrl, setPictureUrl] = useState<string | null>(null);
  const [pictureKey, setPictureKey] = useState<string | null>(null);
  const [uploadingPicture, setUploadingPicture] = useState(false);
  const [pictureError, setPictureError] = useState<string | null>(null);
  const [isCropOpen, setIsCropOpen] = useState(false);
  const [cropImageSrc, setCropImageSrc] = useState<string | null>(null);
  const [audioCount, setAudioCount] = useState<number>(0);
  const [audioIsRecording, setAudioIsRecording] = useState<boolean>(false);
  const [audioError, setAudioError] = useState<string | null>(null);
  const [socialError, setSocialError] = useState<string | null>(null);
  const [verifyingSocial, setVerifyingSocialState] = useState<Record<string, boolean>>({});
  const [showTermsModal, setShowTermsModal] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [acceptingTerms, setAcceptingTerms] = useState(false);
  const [termsError, setTermsError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const answersRef = useRef<Record<string, any>>({});
  const currentStepRef = useRef(0);

  const surveyStepsCount = surveySteps.length;
  const pictureStepIndex = surveyStepsCount;
  const socialStepIndex = surveyStepsCount + 1;
  const audioStepIndex = surveyStepsCount + 2;
  const assetStepIndex = surveyStepsCount + 3;
  const totalSteps = surveyStepsCount + 4;

  answersRef.current = answers;
  currentStepRef.current = currentStep;

  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDirty || isSaving) {
        e.preventDefault();
        e.returnValue = 'You have unsaved changes. Are you sure you want to leave?';
        return e.returnValue;
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isDirty, isSaving]);

  useEffect(() => {
    const loadSurveyData = async () => {
      if (!token) {
        setLoadError(ERROR_MESSAGES.INVALID_SURVEY_LINK);
        setIsLoading(false);
        return;
      }

      try {
        // Fetch survey data and questions in parallel
        const [surveyResponse, questionsResponse] = await Promise.all([
          apiClient.get<SurveyState>(Endpoints.pre_influencers.survey, {
            skipAuth: true,
            params: { token, temp_password },
          }),
          apiClient.get(Endpoints.pre_influencers.surveyQuestions, {
            skipAuth: true,
            params: { token, temp_password },
          }),
        ]);

        const surveyData = surveyResponse.data;
        const questionsData = questionsResponse.data;

        // Parse questions data (handle different response formats)
        const fetchedSteps: SurveyStep[] = Array.isArray(questionsData)
          ? questionsData
          : Array.isArray(questionsData?.sections)
          ? questionsData.sections
          : Array.isArray(questionsData?.steps)
          ? questionsData.steps
          : [];

        const visibleSteps = filterSurveySteps(fetchedSteps);

        if (!visibleSteps.length) {
          throw new Error(ERROR_MESSAGES.NO_SURVEY_QUESTIONS);
        }

        // Set survey steps
        setSurveySteps(visibleSteps);

        // Calculate safe step index
        const maxStep = visibleSteps.length + 3; // +4 for picture/social/audio/asset, -1 for zero-index
        const pictureStartStep = visibleSteps.length;
        const prefersPictureStart = startStep === 'picture';
        const requestedStep = prefersPictureStart
          ? Math.max(surveyData.survey_step || 0, pictureStartStep)
          : (surveyData.survey_step || 0);
        const safeStep = Math.min(requestedStep, maxStep);

        // Set survey data
        setPreInfluencerId(surveyData.pre_influencer_id);
        setPreInfluencerUsername(surveyData.username);
        setAnswers(
          normalizeLoadedSurveyAnswers(surveyData.survey_answers || {}) as Record<
            string,
            any
          >
        );
        setCurrentStep(safeStep);

        if (prefersPictureStart && (surveyData.survey_step || 0) < pictureStartStep) {
          try {
            await apiClient.put(
              Endpoints.pre_influencers.surveyById(surveyData.pre_influencer_id),
              buildSurveySaveBody(
                normalizeLoadedSurveyAnswers(surveyData.survey_answers || {}),
                pictureStartStep
              ),
              {
                skipAuth: true,
                params: { token, temp_password },
              }
            );
          } catch (persistError) {
            console.error('Failed to persist picture start step:', persistError);
          }
        }

        // Check if terms already accepted
        const termsAcceptedValue = Boolean(
          surveyData.survey_answers?.terms_agreement ||
            surveyData.survey_answers?.terms_accepted
        );
        setTermsAccepted(termsAcceptedValue);


        setLoadError(null);
      } catch (error) {
        console.error('Failed to load survey data:', error);
        setLoadError(ERROR_MESSAGES.SURVEY_LINK_EXPIRED);
      } finally {
        setIsLoading(false);
      }
    };

    loadSurveyData();
  }, [startStep, temp_password, token]);

  // Load picture URL from S3 key on page reload
  useEffect(() => {
    if (!preInfluencerId || !answers['profile_picture_key'] || pictureUrl) {
      return;
    }

    const fetchPictureUrl = async () => {
      try {
        const { data } = await apiClient.get<{ url: string }>(
          Endpoints.pre_influencers.pictureUrl(preInfluencerId),
          {
            skipAuth: true,
            params: { token, temp_password },
          }
        );
        setPictureUrl(data.url);
      } catch (error) {
        console.error('Failed to fetch picture URL on reload:', error);
        // Silently fail - picture key is saved, just can't display URL yet
      }
    };

    fetchPictureUrl();
  }, [preInfluencerId, answers, token, temp_password, pictureUrl]);

  // Keep audio count in sync when resuming onboarding (audio step may not be mounted yet)
  useEffect(() => {
    if (!preInfluencerId || isLoading) return;

    let canceled = false;

    const loadAudioCount = async () => {
      try {
        const { data } = await apiClient.get<{ count?: number; files?: unknown[] }>(
          Endpoints.pre_influencers.audio(preInfluencerId),
          {
            skipAuth: true,
            params: { token, temp_password },
          }
        );
        if (canceled) return;
        const count = data.count ?? data.files?.length ?? 0;
        setAudioCount(count);
      } catch (error: any) {
        if (canceled) return;
        const detail = error?.response?.data?.detail;
        if (detail === 'Influencer has no audio file stored') {
          setAudioCount(0);
        }
      }
    };

    void loadAudioCount();

    return () => {
      canceled = true;
    };
  }, [preInfluencerId, isLoading, token, temp_password]);

  const { saveNow } = useAutoSave({
    preInfluencerId,
    answers,
    currentStep,
    isDirty,
    token,
    temp_password,
    onSaveStart: () => setIsSaving(true),
    onSaveComplete: () => {
      setIsSaving(false);
      setIsDirty(false);
    },
    onSaveError: (error) => {
      setIsSaving(false);
      console.error('Save error:', error);
    },
  });

  const updateAnswer = useCallback((key: string, value: any) => {
    const normalizedValue =
      key === 'asset_link' && typeof value === 'string' ? value.trim() : value;
    setAnswers((prev) => {
      const next = { ...prev, [key]: normalizedValue };
      answersRef.current = next;
      return next;
    });
    setIsDirty(true);
    setFieldErrors((prev) => {
      if (!(key in prev)) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }, []);

  const persistSurvey = useCallback(
    async (patch?: Record<string, any>) => {
      if (!preInfluencerId) return;

      const merged = patch
        ? { ...answersRef.current, ...patch }
        : { ...answersRef.current };

      if (patch) {
        setAnswers(merged);
        answersRef.current = merged;
      }

      setIsDirty(true);
      try {
        await saveNow({
          answers: merged,
          step: currentStepRef.current,
        });
      } catch (error) {
        console.error('Failed to persist survey after media upload:', error);
      }
    },
    [preInfluencerId, saveNow]
  );

  const goToNextStep = useCallback(() => {
    if (currentStep < totalSteps - 1) {
      setCurrentStep((prev) => prev + 1);
      setIsDirty(true);
    }
  }, [currentStep, totalSteps]);

  const goToPreviousStep = useCallback(() => {
    if (currentStep > 0) {
      setCurrentStep((prev) => prev - 1);
      setIsDirty(true);
    }
  }, [currentStep]);

  const clearFieldError = useCallback((key: string) => {
    setFieldErrors((prev) => {
      if (!(key in prev)) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }, []);

  const setVerifyingSocial = useCallback((platform: string, verifying: boolean) => {
    setVerifyingSocialState((prev) => ({ ...prev, [platform]: verifying }));
  }, []);

  const state: UseSurveyFormState = {
    preInfluencerId,
    preInfluencerUsername,
    answers,
    currentStep,
    surveySteps,
    isLoading,
    loadError,
    isSaving,
    isDirty,
    pictureUrl,
    pictureKey,
    uploadingPicture,
    pictureError,
    isCropOpen,
    cropImageSrc,
    audioCount,
    audioIsRecording,
    audioError,
    socialError,
    verifyingSocial,
    showTermsModal,
    termsAccepted,
    acceptingTerms,
    termsError,
    fieldErrors,
    surveyStepsCount,
    pictureStepIndex,
    socialStepIndex,
    audioStepIndex,
    assetStepIndex,
    totalSteps,
  };

  const actions: UseSurveyFormActions = {
    updateAnswer,
    goToNextStep,
    goToPreviousStep,
    setCurrentStep,
    setPictureUrl,
    setPictureKey,
    setUploadingPicture,
    setPictureError,
    setIsCropOpen,
    setCropImageSrc,
    setAudioCount,
    setAudioIsRecording,
    setAudioError,
    setSocialError,
    setVerifyingSocial,
    setShowTermsModal,
    setTermsAccepted,
    setAcceptingTerms,
    setTermsError,
    setFieldErrors,
    clearFieldError,
    saveNow,
    persistSurvey,
  };

  return [state, actions];
}
