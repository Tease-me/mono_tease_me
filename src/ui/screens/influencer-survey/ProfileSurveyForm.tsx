// Profile Survey Form - Complete Rewrite
// Main survey form component with improved state management and performance

import React, { lazy, Suspense, useCallback, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { apiClient } from '@/api/apis';
import NormalButton from '@/ui/components/inputs/buttons/NormalButton';
import PrimaryButton from '@/ui/components/inputs/buttons/PrimaryButton';
import SvgPack from '@/utils/SvgPack';
import { useSurveyForm } from './hooks/useSurveyForm';
import { useStepValidation } from './hooks/useStepValidation';
import SurveyQuestionStep from './components/SurveyQuestionStep';
import styles from './ProfileSurvey.module.css';
import { TermsModal } from '../survey/components/TermsConditions';

// Lazy load heavy components for better performance
const UploadPictureStep = lazy(() => import('./components/UploadPictureStep'));
const UploadAudioStep = lazy(() => import('./components/UploadAudioStep'));
const SocialMediaStep = lazy(() => import('./components/SocialMediaStep'));

// Loading fallback component
const LoadingFallback: React.FC = () => (
  <div className={styles.content}>
    <div style={{ textAlign: 'center', padding: '2rem' }}>Loading...</div>
  </div>
);

const ProfileSurveyForm: React.FC = () => {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const contentRef = useRef<HTMLDivElement | null>(null);

  const token = params.get('token') || '';
  const temp_password = params.get('temp_password') || '';

  // Core survey form state (centralized in one hook)
  const [state, actions] = useSurveyForm({ token, temp_password });

  // Validation hook
  const { validateCurrentStep } = useStepValidation({
    stepIndex: state.currentStep,
    surveySteps: state.surveySteps,
    pictureStepIndex: state.pictureStepIndex,
    socialStepIndex: state.socialStepIndex,
    audioStepIndex: state.audioStepIndex,
    answers: state.answers,
    audioCount: state.audioCount,
    audioHasRecorded: state.audioHasRecorded,
  });

  // Scroll to top helper
  const scrollToTop = useCallback(() => {
    const el = contentRef.current;
    if (el) el.scrollTo({ top: 0, behavior: 'smooth' });
    else window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  // Handle terms acceptance
  const handleAcceptTerms = useCallback(async () => {
    if (!state.preInfluencerId) return;

    try {
      actions.setAcceptingTerms(true);
      actions.setTermsError(null);

      await apiClient.post(
        `/pre-influencers/${state.preInfluencerId}/accept-terms`,
        { terms_agreement: true },
        {
          params: token ? { token } : undefined,
        }
      );

      actions.setTermsAccepted(true);
      actions.updateAnswer('terms_agreement', true);
      await actions.saveNow();
      actions.setShowTermsModal(false);
      navigate('/thank-you');
    } catch (error) {
      console.error('Error accepting terms:', error);
      actions.setTermsError('Failed to record acceptance. Please try again.');
    } finally {
      actions.setAcceptingTerms(false);
    }
  }, [state.preInfluencerId, token, navigate, actions]);

  // Handle Next button
  const handleNext = useCallback(async () => {
    // Block all actions if recording/uploading audio
    if (state.audioIsRecording) {
      console.warn('Cannot navigate while recording/uploading audio');
      return;
    }

    // Validate current step
    const validation = validateCurrentStep();
    if (!validation.valid) {
      actions.setFieldErrors(validation.errors);
      return;
    }

    // Clear errors
    actions.setFieldErrors({});

    // Check if last step and terms not accepted
    const isLastStep = state.currentStep === state.totalSteps - 1;
    if (isLastStep && !state.termsAccepted) {
      actions.setTermsError(null);
      actions.setShowTermsModal(true);
      return;
    }

    // Save before navigation
    await actions.saveNow();

    // Navigate or go to next step
    if (state.currentStep < state.totalSteps - 1) {
      actions.goToNextStep();
      requestAnimationFrame(scrollToTop);
    } else {
      navigate('/thank-you');
    }
  }, [
    validateCurrentStep,
    state.currentStep,
    state.totalSteps,
    state.termsAccepted,
    state.audioIsRecording,
    actions,
    navigate,
    scrollToTop,
  ]);

  // Handle Back button
  const handleBack = useCallback(async () => {
    // Block all actions if recording/uploading audio
    if (state.audioIsRecording) {
      console.warn('Cannot navigate while recording/uploading audio');
      return;
    }

    if (state.currentStep === 0) return;
    await actions.saveNow();
    actions.goToPreviousStep();
    requestAnimationFrame(scrollToTop);
  }, [state.currentStep, state.audioIsRecording, actions, scrollToTop]);

  // Loading state
  if (state.isLoading) {
    return (
      <div className={styles.screen}>
        <div className={styles.frame}>
          <div className={styles.card}>Loading survey...</div>
        </div>
      </div>
    );
  }

  // Error state
  if (state.loadError) {
    return (
      <div className={styles.screen}>
        <div className={styles.frame}>
          <div className={styles.card}>
            <p className={`${styles.error} ${styles.errorGeneral}`}>{state.loadError}</p>
          </div>
        </div>
      </div>
    );
  }

  // Determine current step type
  const isSurveyStep = state.currentStep < state.surveyStepsCount;
  const isPictureStep = state.currentStep === state.pictureStepIndex;
  const isSocialsStep = state.currentStep === state.socialStepIndex;
  const isAudioStep = state.currentStep === state.audioStepIndex;
  const isLastStep = state.currentStep === state.totalSteps - 1;

  // Get current survey step
  const currentSurveyStep = isSurveyStep && state.surveySteps[state.currentStep]
    ? state.surveySteps[state.currentStep]
    : null;

  // Debug: Log when step is missing
  if (isSurveyStep && !currentSurveyStep) {
    console.warn(`Missing survey step at index ${state.currentStep}. Total steps: ${state.surveySteps.length}`);
  }

  // Determine step title
  let stepTitle = 'Profile Survey';
  if (isSurveyStep && currentSurveyStep) {
    stepTitle = currentSurveyStep.title;
  } else if (isPictureStep) {
    stepTitle = 'Upload Your Picture';
  } else if (isSocialsStep) {
    stepTitle = 'Add Your Social Media';
  } else if (isAudioStep) {
    stepTitle = 'Upload Your Audio';
  }

  return (
    <div className={styles.screen}>
      {/* Terms Modal */}
      <TermsModal
        isOpen={state.showTermsModal}
        onClose={() => actions.setShowTermsModal(false)}
        onAccept={handleAcceptTerms}
        accepting={state.acceptingTerms}
        error={state.termsError}
      />

      <div className={styles.outerframe}>
        <div className={styles.frame}>
          <div className={`${styles.card} ${styles.formCard}`} ref={contentRef}>
            {/* Header */}
            <div className={styles.headerRow}>
              <div>
                <h2 className={styles.title}>{stepTitle}</h2>
                <p className={styles.subtitle}>
                  Step {state.currentStep + 1} of {state.totalSteps}
                </p>
              </div>
              <span className={styles.saving}>{state.isSaving ? 'Saving...' : 'Saved'}</span>
            </div>

            {/* Step Content */}
            <div className={styles.content}>
              {/* Survey Question Steps */}
              {isSurveyStep && currentSurveyStep && (
                <SurveyQuestionStep
                  step={currentSurveyStep}
                  answers={state.answers}
                  errors={state.fieldErrors}
                  onAnswerChange={actions.updateAnswer}
                />
              )}

              {/* Fallback if step not found */}
              {isSurveyStep && !currentSurveyStep && (
                <div style={{ padding: '2rem', textAlign: 'center', color: '#fff' }}>
                  <p>Loading survey questions...</p>
                  <p style={{ fontSize: '14px', color: '#999', marginTop: '8px' }}>
                    Step {state.currentStep + 1} of {state.totalSteps}
                  </p>
                </div>
              )}

              {/* Picture Upload Step */}
              {isPictureStep && (
                <Suspense fallback={<LoadingFallback />}>
                  <UploadPictureStep
                    preInfluencerId={state.preInfluencerId}
                    preInfluencerUsername={state.preInfluencerUsername}
                    token={token}
                    temp_password={temp_password}
                    pictureUrl={state.pictureUrl}
                    pictureError={state.pictureError}
                    uploadingPicture={state.uploadingPicture}
                    isCropOpen={state.isCropOpen}
                    cropImageSrc={state.cropImageSrc}
                    onPictureUrlChange={actions.setPictureUrl}
                    onPictureKeyChange={actions.setPictureKey}
                    onUploadingChange={actions.setUploadingPicture}
                    onErrorChange={actions.setPictureError}
                    onCropOpenChange={actions.setIsCropOpen}
                    onCropImageSrcChange={actions.setCropImageSrc}
                    onAnswerChange={actions.updateAnswer}
                  />
                </Suspense>
              )}

              {/* Social Media Step */}
              {isSocialsStep && (
                <Suspense fallback={<LoadingFallback />}>
                  <SocialMediaStep
                    answers={state.answers}
                    socialError={state.socialError}
                    verifyingSocial={state.verifyingSocial}
                    onAnswerChange={actions.updateAnswer}
                    onSocialErrorChange={actions.setSocialError}
                    onVerifyingSocialChange={actions.setVerifyingSocial}
                  />
                </Suspense>
              )}

              {/* Audio Upload Step */}
              {isAudioStep && state.preInfluencerId && (
                <Suspense fallback={<LoadingFallback />}>
                  <UploadAudioStep
                    influencerId={state.preInfluencerId}
                    token={token}
                    temp_password={temp_password}
                    audioCount={state.audioCount}
                    audioHasRecorded={state.audioHasRecorded}
                    audioIsRecording={state.audioIsRecording}
                    audioError={state.audioError}
                    onCountChange={actions.setAudioCount}
                    onHasRecordedChange={actions.setAudioHasRecorded}
                    onIsRecordingChange={actions.setAudioIsRecording}
                    onErrorChange={actions.setAudioError}
                  />
                </Suspense>
              )}
            </div>

            {/* Bottom Navigation */}
            <div className={styles.bottomBar}>
              <div className={styles.buttonRow}>
                <div>
                  <NormalButton
                    onClick={handleBack}
                    text="Back"
                    disabled={state.currentStep === 0 || state.audioIsRecording}
                    leftIcon={<SvgPack.ArrowLeft />}
                  />
                </div>
                <div>
                  <PrimaryButton
                    onClick={handleNext}
                    text={isLastStep ? 'Finish' : 'Next'}
                    disabled={
                      state.audioIsRecording ||
                      (isAudioStep && (!state.audioHasRecorded || state.audioCount === 0))
                    }
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
