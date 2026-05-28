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

const UploadPictureStep = lazy(() => import('./components/UploadPictureStep'));
const UploadAudioStep = lazy(() => import('./components/UploadAudioStep'));
const AssetUploadStep = lazy(() => import('./components/AssetUploadStep'));

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

  const [state, actions] = useSurveyForm({ token, temp_password, startStep: 'picture' });

  const { validateCurrentStep } = useStepValidation({
    stepIndex: state.currentStep,
    surveySteps: state.surveySteps,
    pictureStepIndex: state.pictureStepIndex,
    assetStepIndex: state.assetStepIndex,
    answers: state.answers,
    audioCount: state.audioCount,
  });

  useEffect(() => {
    if (!state.isLoading && !state.loadError) {
      if (!isMediaRecorderSupported() || !isGetUserMediaSupported()) {
        actions.setFieldErrors({
          _browser:
            'Your browser does not support audio recording. Please use Chrome, Firefox, or Safari 14.5+ to complete this survey.',
        });
      }
    }
  }, [state.isLoading, state.loadError, actions]);

  const scrollToTop = useCallback(() => {
    const screenElement = document.querySelector(`.${styles.screen}`);
    if (screenElement) {
      screenElement.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, []);

  useEffect(() => {
    scrollToTop();
  }, [state.currentStep, scrollToTop]);

  const isSurveyStep = state.currentStep < state.surveyStepsCount;
  const isMediaStep = state.currentStep === state.pictureStepIndex;
  const isAssetStep = state.currentStep === state.assetStepIndex;
  const isLastStep = state.currentStep === state.totalSteps - 1;
  const lockBack = state.currentStep <= state.pictureStepIndex;

  const handleAcceptTerms = useCallback(async () => {
    if (!state.preInfluencerId) return;

    try {
      actions.setAcceptingTerms(true);
      actions.setTermsError(null);

      await apiClient.post(
        Endpoints.pre_influencers.acceptTerms(state.preInfluencerId),
        { terms_agreement: true },
        {
          skipAuth: true,
          params: { token, temp_password },
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
      navigate(`${Paths.thankYou}?variant=${THANK_YOU_VARIANTS.profileComplete}`, {
        replace: true,
      });
    } catch (error) {
      console.error('Error accepting terms:', error);
      actions.setTermsError('Failed to record acceptance. Please try again.');
    } finally {
      actions.setAcceptingTerms(false);
    }
  }, [state.preInfluencerId, token, temp_password, navigate, actions]);

  const handleNext = useCallback(async () => {
    if (state.audioIsRecording) {
      console.warn('Cannot navigate while recording/uploading audio');
      return;
    }

    const validation = validateCurrentStep();
    if (!validation.valid) {
      actions.setFieldErrors(validation.errors);

      if (isMediaStep && validation.errors['profile_picture_key']) {
        actions.setPictureError(validation.errors['profile_picture_key']);
      }
      if (isMediaStep && validation.errors['audio']) {
        actions.setAudioError(validation.errors['audio']);
      }

      return;
    }

    actions.setFieldErrors({});
    actions.setPictureError(null);
    actions.setAudioError(null);

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
      navigate(`${Paths.thankYou}?variant=${THANK_YOU_VARIANTS.profileComplete}`, {
        replace: true,
      });
    }
  }, [
    validateCurrentStep,
    isMediaStep,
    isLastStep,
    state.currentStep,
    state.totalSteps,
    state.termsAccepted,
    state.audioIsRecording,
    actions,
    navigate,
    scrollToTop,
  ]);

  const handleBack = useCallback(async () => {
    if (state.audioIsRecording) return;
    if (lockBack) return;

    try {
      await actions.saveNow();
    } catch (error) {
      console.error('Failed to save before going back:', error);
      actions.setFieldErrors({ _save: 'Failed to save your progress. Please try again.' });
      return;
    }

    actions.goToPreviousStep();
    requestAnimationFrame(scrollToTop);
  }, [state.audioIsRecording, lockBack, actions, scrollToTop]);

  if (state.isLoading) {
    return (
      <div className={styles.screen}>
        <div className={styles.frame}>
          <div className={styles.card}>Loading survey...</div>
        </div>
      </div>
    );
  }

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

  const currentSurveyStep =
    isSurveyStep && state.surveySteps[state.currentStep]
      ? state.surveySteps[state.currentStep]
      : null;

  let stepTitle = 'Profile Survey';
  if (isSurveyStep && currentSurveyStep) {
    stepTitle = currentSurveyStep.title;
  } else if (isMediaStep) {
    stepTitle = 'Photo & Voice';
  } else if (isAssetStep) {
    stepTitle = 'Assets';
  }

  return (
    <div className={styles.screen}>
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
            <div className={styles.headerRow}>
              <div>
                <h2 className={styles.title}>{stepTitle}</h2>
              </div>
              <span className={styles.saving}>{state.isSaving ? 'Saving...' : 'Saved'}</span>
            </div>

            {state.fieldErrors._browser && isMediaStep && (
              <div className={styles.inlineAlert}>{state.fieldErrors._browser}</div>
            )}

            {state.fieldErrors._save && (
              <div className={styles.inlineAlert}>{state.fieldErrors._save}</div>
            )}

            <div className={styles.content}>
              {isSurveyStep && currentSurveyStep && (
                <SurveyQuestionStep
                  step={currentSurveyStep}
                  answers={state.answers}
                  errors={state.fieldErrors}
                  onAnswerChange={actions.updateAnswer}
                />
              )}

              {isMediaStep && (
                <div className={styles.mediaStepStack}>
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
                      onPersistSurvey={actions.persistSurvey}
                    />
                  </Suspense>

                  {state.preInfluencerId && (
                    <Suspense fallback={<LoadingFallback />}>
                      <UploadAudioStep
                        preInfluencerId={state.preInfluencerId}
                        token={token}
                        temp_password={temp_password}
                        audioError={state.audioError}
                        onCountChange={actions.setAudioCount}
                        onIsRecordingChange={actions.setAudioIsRecording}
                        onErrorChange={actions.setAudioError}
                        onPersistSurvey={() => actions.persistSurvey()}
                      />
                    </Suspense>
                  )}
                </div>
              )}

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
                      disabled={lockBack || state.audioIsRecording}
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

            <div className={styles.spacerSurvey} />
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProfileSurveyForm;
