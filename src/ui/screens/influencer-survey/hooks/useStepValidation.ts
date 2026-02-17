// Step Validation Hook
// Validates the current survey step

import { useCallback } from 'react';
import {
  SurveyStep,
  validateSurveyStep,
  validatePictureStep,
  validateSocialStep,
  validateAudioStep,
  ValidationResult,
} from '../validation/surveyValidation';

interface UseStepValidationProps {
  stepIndex: number;
  surveySteps: SurveyStep[];
  pictureStepIndex: number;
  socialStepIndex: number;
  audioStepIndex: number;
  answers: Record<string, any>;
  audioCount: number;
  audioHasRecorded: boolean;
}

/**
 * Hook for validating the current step
 * Returns validation function and result
 */
export function useStepValidation({
  stepIndex,
  surveySteps,
  pictureStepIndex,
  socialStepIndex,
  audioStepIndex,
  answers,
  audioCount,
  audioHasRecorded,
}: UseStepValidationProps) {
  /**
   * Validate the current step
   */
  const validateCurrentStep = useCallback((): ValidationResult => {
    // Survey question steps
    if (stepIndex < surveySteps.length) {
      const currentStep = surveySteps[stepIndex];
      if (!currentStep) {
        // If step doesn't exist but we're within valid range, allow navigation
        // This prevents being stuck on loading states
        console.warn(`Survey step ${stepIndex} not found, allowing navigation`);
        return { valid: true, errors: {} };
      }
      return validateSurveyStep(currentStep, answers);
    }

    // Picture upload step
    if (stepIndex === pictureStepIndex) {
      return validatePictureStep(answers);
    }

    // Social media step
    if (stepIndex === socialStepIndex) {
      return validateSocialStep(answers);
    }

    // Audio upload step
    if (stepIndex === audioStepIndex) {
      return validateAudioStep(audioCount, audioHasRecorded);
    }

    // Unknown step - pass validation
    return { valid: true, errors: {} };
  }, [
    stepIndex,
    surveySteps,
    pictureStepIndex,
    socialStepIndex,
    audioStepIndex,
    answers,
    audioCount,
    audioHasRecorded,
  ]);

  return { validateCurrentStep };
}
