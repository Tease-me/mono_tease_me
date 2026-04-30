// Survey Form Constants

// File Upload Limits
export const MAX_IMAGE_SIZE_MB = 10;
export const MAX_IMAGE_SIZE_BYTES = MAX_IMAGE_SIZE_MB * 1024 * 1024;

export const MAX_AUDIO_SIZE_MB = 20;
export const MAX_AUDIO_SIZE_BYTES = MAX_AUDIO_SIZE_MB * 1024 * 1024;

// Image Requirements
export const MIN_IMAGE_WIDTH = 200;
export const MIN_IMAGE_HEIGHT = 200;
export const MIN_ASPECT_RATIO = 0.5; // 1:2
export const MAX_ASPECT_RATIO = 2.0; // 2:1

// Audio Requirements
export const MIN_RECORDING_SECONDS = 15;
export const RECORDING_COUNTDOWN_SECONDS = 3;

// Accepted File Types
export const ACCEPTED_IMAGE_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
] as const;

export const ACCEPTED_AUDIO_TYPES = [
  'audio/mpeg',
  'audio/mp3',
  'audio/wav',
  'audio/webm',
  'audio/mp4',
  'audio/m4a',
  'audio/ogg',
] as const;

// Auto-Save Settings
export const AUTO_SAVE_DEBOUNCE_MS = 2000;

// Social Media Platforms
export const SOCIAL_PLATFORMS = [
  'instagram',
  'tiktok',
  'snapchat',
  'telegram',
  'x',
  'onlyfans',
  'whatsapp',
] as const;

// Platforms that support auto-verification
export const VERIFIABLE_PLATFORMS = new Set(['instagram', 'x']);

// Service name mapping for API calls
export const PLATFORM_SERVICE_MAP: Record<string, string> = {
  instagram: 'instagram',
  x: 'twitter',
};

// Audio Format Support
export const AUDIO_FORMAT_CANDIDATES = [
  { mimeType: 'audio/webm;codecs=opus', extension: 'webm' },
  { mimeType: 'audio/webm', extension: 'webm' },
  { mimeType: 'audio/mp4;codecs=mp4a.40.2', extension: 'm4a' },
  { mimeType: 'audio/mp4', extension: 'm4a' },
  { mimeType: 'audio/ogg;codecs=opus', extension: 'ogg' },
  { mimeType: 'audio/ogg', extension: 'ogg' },
] as const;

// Error Messages
export const ERROR_MESSAGES = {
  // General
  INVALID_SURVEY_LINK: 'Invalid survey link.',
  SURVEY_LINK_EXPIRED: 'This survey link is invalid or expired.',
  NO_SURVEY_QUESTIONS: 'No survey questions returned.',

  // Image Upload
  IMAGE_REQUIRED: 'Please upload a profile picture before continuing.',
  IMAGE_TOO_LARGE: `Image must be under ${MAX_IMAGE_SIZE_MB}MB.`,
  IMAGE_INVALID_TYPE: 'Image must be JPEG, PNG, WEBP, or HEIC format.',
  IMAGE_TOO_SMALL: `Image must be at least ${MIN_IMAGE_WIDTH}x${MIN_IMAGE_HEIGHT} pixels.`,
  IMAGE_INVALID_ASPECT: 'Image aspect ratio must be between 1:2 and 2:1.',
  IMAGE_UPLOAD_FAILED: 'Error uploading picture. Please try again.',
  IMAGE_DIMENSIONS_FAILED: 'Failed to load image dimensions.',

  // Audio Upload
  AUDIO_REQUIRED: 'Please upload at least one audio sample.',
  AUDIO_TOO_LARGE: `Audio file must be under ${MAX_AUDIO_SIZE_MB}MB.`,
  AUDIO_INVALID_TYPE: 'Please upload an audio file (MP3, WAV, WEBM, etc.).',
  AUDIO_UPLOAD_FAILED: 'Failed to upload audio. Please try again.',
  AUDIO_DELETE_FAILED: 'Failed to delete audio. Please try again.',
  AUDIO_NO_DATA: 'No audio captured. Please try recording again.',
  AUDIO_RECORDING_FAILED: 'Recording failed. Please try again.',
  AUDIO_MIC_BLOCKED: 'Microphone is blocked or unavailable. Please allow mic access and try again.',
  AUDIO_MIC_UNAVAILABLE: 'Unable to start recording. Please try again.',
  AUDIO_NOT_SUPPORTED: 'Recording not supported in this browser.',
  AUDIO_TOO_SHORT: `Please record at least ${MIN_RECORDING_SECONDS} seconds before stopping.`,

  // Social Media
  SOCIAL_REQUIRED: 'Please add at least one social media handle.',
  SOCIAL_HANDLE_REQUIRED: 'Please enter your handle before continuing.',
  SOCIAL_HANDLE_REQUIRED_CONNECT: 'Please enter your handle before connecting.',
  SOCIAL_CONNECTION_FAILED: 'Connection failed. Please enter manually.',

  // Asset Upload
  ASSET_LINK_REQUIRED: 'Please paste a link to your assets before continuing.',

  // Terms
  TERMS_ACCEPT_FAILED: 'Failed to record acceptance. Please try again.',

  // Save
  SAVE_FAILED: 'Failed to save your progress. Please try again.',
} as const;

// Success Messages
export const SUCCESS_MESSAGES = {
  PICTURE_UPLOADED: 'Picture uploaded successfully!',
  AUDIO_UPLOADED: 'Audio uploaded successfully!',
  SOCIAL_VERIFIED: 'Verified successfully!',
  PROGRESS_SAVED: 'Progress saved!',
} as const;
