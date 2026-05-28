import { ERROR_MESSAGES, REQUIRED_SOCIAL_PLATFORMS, SOCIAL_PLATFORMS } from '../utils/constants';

export interface SurveyQuestion {
  id: string;
  label: string;
  type: 'text' | 'textarea' | 'radio' | 'checkbox';
  required?: boolean;
  min?: number;
  max?: number;
  placeholder?: string;
  options?: { value: string | number; label: string }[];
}

export interface SurveyStep {
  id: string;
  title: string;
  questions: SurveyQuestion[];
}

export interface ValidationResult {
  valid: boolean;
  errors: Record<string, string>;
}

export function validateSurveyStep(
  step: SurveyStep,
  answers: Record<string, any>
): ValidationResult {
  const errors: Record<string, string> = {};

  step.questions.forEach((question) => {
    const value = answers[question.id];

    if (question.type === 'checkbox') {
      const selectedCount = Array.isArray(value) ? value.length : 0;

      if (question.required && selectedCount === 0) {
        errors[question.id] = 'This field is required';
      } else if (question.min && selectedCount < question.min) {
        errors[question.id] = `Please select at least ${question.min} options`;
      } else if (question.max && selectedCount > question.max) {
        errors[question.id] = `Please select no more than ${question.max} options`;
      }
      return;
    }

    if (!question.required) return;

    // Check if value is empty for text/radio
    const isEmpty =
      value === undefined ||
      value === null ||
      (typeof value === 'string' && value.trim() === '');

    if (isEmpty) {
      errors[question.id] = 'This field is required';
    }
  });

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
}

export function validateField(
  question: SurveyQuestion,
  value: any
): string | undefined {
  if (!question.required) return undefined;

  const isEmpty =
    value === undefined ||
    value === null ||
    (typeof value === 'string' && value.trim() === '');

  if (isEmpty) {
    return `${question.label} is required`;
  }

  return undefined;
}

export function validatePictureStep(answers: Record<string, any>): ValidationResult {
  const errors: Record<string, string> = {};
  const key = answers['profile_picture_key'];

  if (!key || typeof key !== 'string' || !key.trim()) {
    errors['profile_picture_key'] = ERROR_MESSAGES.IMAGE_REQUIRED;
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
}

export function validateSocialStep(answers: Record<string, any>): ValidationResult {
  const errors: Record<string, string> = {};

  for (const platform of REQUIRED_SOCIAL_PLATFORMS) {
    const handle = answers[`social_${platform}`];
    const hasHandle = typeof handle === 'string' && handle.trim().length > 0;

    if (!hasHandle) {
      errors['social_media'] = ERROR_MESSAGES.SOCIAL_REQUIRED;
      break;
    }
  }

  // Validate follower count for all platforms with handles
  for (const platform of SOCIAL_PLATFORMS) {
    const handle = answers[`social_${platform}`];
    const followers = answers[`social_${platform}_followers`];

    // If platform has a handle, verify it has at least 1 follower
    if (handle && typeof handle === 'string' && handle.trim().length > 0) {
      const followerCount = typeof followers === 'number' ? followers : 0;
      if (followerCount <= 0) {
        errors['social_media'] = 'Cannot have 0 followers.';
        break;
      }
    }
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
}

export function validateAudioStep(audioCount: number): ValidationResult {
  const errors: Record<string, string> = {};

  if (audioCount <= 0) {
    errors['audio'] = ERROR_MESSAGES.AUDIO_REQUIRED;
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
}

/** Step 02 — profile photo and at least one voice sample. */
export function validatePhotoVoiceStep(
  answers: Record<string, any>,
  audioCount: number
): ValidationResult {
  const picture = validatePictureStep(answers);
  const audio = validateAudioStep(audioCount);
  return {
    valid: picture.valid && audio.valid,
    errors: { ...picture.errors, ...audio.errors },
  };
}

export function validateAssetStep(answers: Record<string, any>): ValidationResult {
  const errors: Record<string, string> = {};
  const link = answers['asset_link'];

  if (link && typeof link === 'string' && link.trim()) {
    try {
      new URL(link.trim());
    } catch {
      errors['asset_link'] =
        'Please enter a valid link (e.g. from Google Drive, Dropbox or iCloud).';
    }
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
}

export function validateSocialHandle(handle: string): string | undefined {
  const trimmed = (handle || '').trim();
  if (!trimmed) {
    return ERROR_MESSAGES.SOCIAL_HANDLE_REQUIRED;
  }
  return undefined;
}

export function parseFollowerCount(value: string): number {
  const num = Number(value);
  return Number.isFinite(num) && num >= 0 ? num : 0;
}
