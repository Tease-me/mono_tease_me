import { useState, useCallback, useEffect } from 'react';
import { apiClient } from '@/api/apis';
import { SurveyStep } from '../validation/surveyValidation';
import { useAutoSave } from './useAutoSave';
import { ERROR_MESSAGES } from '../utils/constants';

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
  audioHasRecorded: boolean;
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
  setAudioHasRecorded: (hasRecorded: boolean) => void;
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
}

interface UseSurveyFormParams {
  token: string;
  temp_password: string;
}

export function useSurveyForm({
  token,
  temp_password,
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
  const [audioHasRecorded, setAudioHasRecorded] = useState<boolean>(false);
  const [audioIsRecording, setAudioIsRecording] = useState<boolean>(false);
  const [audioError, setAudioError] = useState<string | null>(null);
  const [socialError, setSocialError] = useState<string | null>(null);
  const [verifyingSocial, setVerifyingSocialState] = useState<Record<string, boolean>>({});
  const [showTermsModal, setShowTermsModal] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [acceptingTerms, setAcceptingTerms] = useState(false);
  const [termsError, setTermsError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const surveyStepsCount = surveySteps.length;
  const pictureStepIndex = surveyStepsCount;
  const socialStepIndex = surveyStepsCount + 1;
  const audioStepIndex = surveyStepsCount + 2;
  const totalSteps = surveyStepsCount + 3;

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
          apiClient.get<SurveyState>('/pre-influencers/survey', {
            params: { token, temp_password },
          }),
          apiClient.get('/pre-influencers/survey/questions', {
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

        if (!fetchedSteps.length) {
          throw new Error(ERROR_MESSAGES.NO_SURVEY_QUESTIONS);
        }

        // Set survey steps
        setSurveySteps(fetchedSteps);

        // Calculate safe step index
        const maxStep = fetchedSteps.length + 2; // +3 for picture/social/audio, -1 for zero-index
        const safeStep = Math.min(surveyData.survey_step || 0, maxStep);

        // Set survey data
        setPreInfluencerId(surveyData.pre_influencer_id);
        setPreInfluencerUsername(surveyData.username);
        setAnswers(surveyData.survey_answers || {});
        setCurrentStep(safeStep);

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
  }, [token, temp_password]);

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
    setAnswers((prev) => ({ ...prev, [key]: value }));
    setIsDirty(true);
    setFieldErrors((prev) => {
      const { [key]: _, ...rest } = prev;
      return rest;
    });
  }, []);

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
      const { [key]: _, ...rest } = prev;
      return rest;
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
    audioHasRecorded,
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
    setAudioHasRecorded,
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
  };

  return [state, actions];
}
