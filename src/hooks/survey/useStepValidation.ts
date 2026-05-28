// Step Validation Hook
// Validates the current survey step

import { useCallback } from 'react';
import {
  SurveyStep,
  validateSurveyStep,
  validatePhotoVoiceStep,
  validateAssetStep,
  ValidationResult,
} from '@/ui/screens/influencer-survey/validation/surveyValidation';

interface UseStepValidationProps {
  stepIndex: number;
  surveySteps: SurveyStep[];
  pictureStepIndex: number;
  assetStepIndex: number;
  answers: Record<string, any>;
  audioCount: number;
}

/**
 * Hook for validating the current step
 * Returns validation function and result
 */
export function useStepValidation({
  stepIndex,
  surveySteps,
  pictureStepIndex,
  assetStepIndex,
  answers,
  audioCount,
}: UseStepValidationProps) {
  const validateCurrentStep = useCallback((): ValidationResult => {
    if (stepIndex < surveySteps.length) {
      const currentStep = surveySteps[stepIndex];
      if (!currentStep) {
        console.warn(`Survey step ${stepIndex} not found, allowing navigation`);
        return { valid: true, errors: {} };
      }
      return validateSurveyStep(currentStep, answers);
    }

    if (stepIndex === pictureStepIndex) {
      return validatePhotoVoiceStep(answers, audioCount);
    }

    if (stepIndex === assetStepIndex) {
      return validateAssetStep(answers);
    }

    return { valid: true, errors: {} };
  }, [
    stepIndex,
    surveySteps,
    pictureStepIndex,
    assetStepIndex,
    answers,
    audioCount,
  ]);

  return { validateCurrentStep };
}
