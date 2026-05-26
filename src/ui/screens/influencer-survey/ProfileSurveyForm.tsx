import React, { lazy, Suspense, useCallback, useRef, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { apiClient } from '@/api/apis';
import { Endpoints } from '@/api/urls';
import { Paths } from '@/routes/path';
import { THANK_YOU_VARIANTS } from '@/ui/screens/join/subscreens/thankYouVariants';
import NormalButton from '@/ui/components/inputs/buttons/NormalButton';
import PrimaryButton from '@/ui/components/inputs/buttons/PrimaryButton';
import SvgPack from '@/utils/SvgPack';
import { useSurveyForm } from '@/hooks/survey/useSurveyForm';
import { useStepValidation } from '@/hooks/survey/useStepValidation';
import SurveyQuestionStep from './components/SurveyQuestionStep';
import styles from './ProfileSurvey.module.css';
import { TermsModal } from '../survey/components/TermsConditions';
import { isMediaRecorderSupported, isGetUserMediaSupported } from './utils/fileUploadHelpers';

// Lazy load heavy components for better performance
const UploadPictureStep = lazy(() => import('./components/UploadPictureStep'));
const UploadAudioStep = lazy(() => import('./components/UploadAudioStep'));
const SocialMediaStep = lazy(() => import('./components/SocialMediaStep'));
const AssetUploadStep = lazy(() => import('./components/AssetUploadStep'));

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
    assetStepIndex: state.assetStepIndex,
    answers: state.answers,
    audioCount: state.audioCount,
  });

  useEffect(() => {
    if (!state.isLoading && !state.loadError && state.surveySteps.length > 0) {
      if (!isMediaRecorderSupported() || !isGetUserMediaSupported()) {
        actions.setFieldErrors({
          _browser: 'Your browser does not support audio recording. Please use Chrome, Firefox, or Safari 14.5+ to complete this survey.'
        });
      }
    }
  }, [state.isLoading, state.loadError, state.surveySteps.length, actions]);

  const scrollToTop = useCallback(() => {
    const screenElement = document.querySelector(`.${styles.screen}`);
    if (screenElement) {
      screenElement.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, []);

  useEffect(() => {
    scrollToTop();
  }, [state.currentStep, scrollToTop]);

  // Handle terms acceptance
  const handleAcceptTerms = useCallback(async () => {
    if (!state.preInfluencerId) return;

    try {
      actions.setAcceptingTerms(true);
      actions.setTermsError(null);

      await apiClient.post(
        Endpoints.pre_influencers.acceptTerms(state.preInfluencerId),
        { terms_agreement: true },
        {
          params: token ? { token } : undefined,
        }
      );

      actions.setTermsAccepted(true);
      actions.updateAnswer('terms_agreement', true);

      try {
        await actions.saveNow();
      } catch (saveError) {
        console.error('Failed to save after accepting terms:', saveError);
        actions.setTermsError('Failed to save your acceptance. Please try again.');
        return;
      }

      actions.setShowTermsModal(false);
      navigate(Paths.thankYou, {
        replace: true,
        state: { variant: THANK_YOU_VARIANTS.profileComplete },
      });
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

      // Map specific errors to their component states
      if (isPictureStep && validation.errors['profile_picture_key']) {
        actions.setPictureError(validation.errors['profile_picture_key']);
      }
      if (isSocialsStep && validation.errors['social_media']) {
        actions.setSocialError(validation.errors['social_media']);
      }
      if (isAudioStep && validation.errors['audio']) {
        actions.setAudioError(validation.errors['audio']);
      }

      // Scroll to first error field for survey question steps
      const isSurveyStep = state.currentStep < state.surveyStepsCount;
      if (isSurveyStep) {
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            const errorElement = document.querySelector('[class*="error"]');
            if (errorElement) {
              const fieldContainer = errorElement.closest('[class*="field"]');
              const scrollTarget = fieldContainer || errorElement;

              const screenElement = document.querySelector(`.${styles.screen}`);
              if (screenElement) {
                const targetRect = scrollTarget.getBoundingClientRect();
                const screenRect = screenElement.getBoundingClientRect();
                const scrollPosition = targetRect.top - screenRect.top + screenElement.scrollTop - 80;
                screenElement.scrollTo({ top: scrollPosition, behavior: 'smooth' });
              }
            }
          });
        });
      }

      return;
    }

    // Clear errors
    actions.setFieldErrors({});
    actions.setPictureError(null);
    actions.setSocialError(null);
    actions.setAudioError(null);

    // Check if last step and terms not accepted
    const isLastStep = state.currentStep === state.totalSteps - 1;
    if (isLastStep && !state.termsAccepted) {
      actions.setTermsError(null);
      actions.setShowTermsModal(true);
      return;
    }

    try {
      await actions.saveNow();
    } catch (error) {
      console.error('Failed to save before navigation:', error);
      actions.setFieldErrors({ _save: 'Failed to save your progress. Please try again.' });
      return;
    }

    if (state.currentStep < state.totalSteps - 1) {
      actions.goToNextStep();
      requestAnimationFrame(scrollToTop);
    } else {
      navigate(Paths.thankYou, {
        replace: true,
        state: { variant: THANK_YOU_VARIANTS.profileComplete },
      });
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

    try {
      await actions.saveNow();
    } catch (error) {
      console.error('Failed to save before going back:', error);
      actions.setFieldErrors({ _save: 'Failed to save your progress. Please try again.' });
      return;
    }

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
  const isAssetStep = state.currentStep === state.assetStepIndex;
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
  } else if (isAssetStep) {
    stepTitle = 'Asset Upload';
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
              </div>
              <span className={styles.saving}>{state.isSaving ? 'Saving...' : 'Saved'}</span>
            </div>

            {state.fieldErrors._browser && isAudioStep && (
              <div style={{
                padding: '12px 16px',
                margin: '8px 0',
                backgroundColor: 'rgba(255, 77, 77, 0.15)',
                border: '1px solid rgba(255, 77, 77, 0.4)',
                borderRadius: '8px',
                color: '#ff6b6b',
                fontSize: '13px',
                textAlign: 'center',
                lineHeight: '1.4'
              }}>
                ⚠️ {state.fieldErrors._browser}
              </div>
            )}

            {state.fieldErrors._save && (
              <div style={{
                padding: '12px 16px',
                margin: '8px 0',
                backgroundColor: 'rgba(255, 77, 77, 0.15)',
                border: '1px solid rgba(255, 77, 77, 0.4)',
                borderRadius: '8px',
                color: '#ff6b6b',
                fontSize: '13px',
                textAlign: 'center',
                lineHeight: '1.4'
              }}>
                ⚠️ {state.fieldErrors._save}
              </div>
            )}

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
                    onVerifyingSocialChange={actions.setVerifyingSocial}
                  />
                </Suspense>
              )}

              {/* Audio Upload Step */}
              {isAudioStep && state.preInfluencerId && (
                <Suspense fallback={<LoadingFallback />}>
                  <UploadAudioStep
                    preInfluencerId={state.preInfluencerId}
                    token={token}
                    temp_password={temp_password}
                    audioError={state.audioError}
                    onCountChange={actions.setAudioCount}
                    onIsRecordingChange={actions.setAudioIsRecording}
                    onErrorChange={actions.setAudioError}
                  />
                </Suspense>
              )}

              {/* Asset Upload Step */}
              {isAssetStep && (
                <Suspense fallback={<LoadingFallback />}>
                  <AssetUploadStep
                    pictureUrl={state.pictureUrl}
                    username={state.preInfluencerUsername}
                    assetLink={state.answers['asset_link'] || ''}
                    assetError={state.fieldErrors['asset_link'] || null}
                    onAssetLinkChange={(value) => actions.updateAnswer('asset_link', value)}
                  />
                </Suspense>
              )}
            </div>

            {/* Bottom Navigation */}
            <div className={styles.bottomBar}>
              {isAssetStep ? (
                <div className={styles.submitRow}>
                  <div className={styles.submitButtonWrap}>
                    <PrimaryButton
                      onClick={handleNext}
                      text="Submit"
                      disabled={!validateCurrentStep().valid}
                    />
                  </div>
                </div>
              ) : (
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
                      disabled={state.audioIsRecording || !validateCurrentStep().valid}
                      rightIcon={<SvgPack.ArrowRight />}
                    />
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
