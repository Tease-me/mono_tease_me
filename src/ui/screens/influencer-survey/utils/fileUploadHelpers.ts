import {
  MAX_IMAGE_SIZE_BYTES,
  MAX_AUDIO_SIZE_BYTES,
  MIN_IMAGE_WIDTH,
  MIN_IMAGE_HEIGHT,
  MIN_ASPECT_RATIO,
  MAX_ASPECT_RATIO,
  ACCEPTED_IMAGE_TYPES,
  ERROR_MESSAGES,
  AUDIO_FORMAT_CANDIDATES,
} from './constants';

export interface ImageDimensions {
  width: number;
  height: number;
}

export interface ImageValidationResult {
  valid: boolean;
  error?: string;
  dimensions?: ImageDimensions;
}

/**
 * Get image dimensions from a File object
 */
export async function getImageDimensions(file: File): Promise<ImageDimensions> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);

    img.onload = () => {
      const dimensions = {
        width: img.width,
        height: img.height,
      };
      URL.revokeObjectURL(objectUrl);
      resolve(dimensions);
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error(ERROR_MESSAGES.IMAGE_DIMENSIONS_FAILED));
    };

    img.src = objectUrl;
  });
}

export async function validateImageFile(file: File | null | undefined): Promise<ImageValidationResult> {
  if (!file) {
    return { valid: false, error: ERROR_MESSAGES.IMAGE_REQUIRED };
  }

  if (!ACCEPTED_IMAGE_TYPES.includes(file.type as any)) {
    return { valid: false, error: ERROR_MESSAGES.IMAGE_INVALID_TYPE };
  }

  if (file.size > MAX_IMAGE_SIZE_BYTES) {
    return { valid: false, error: ERROR_MESSAGES.IMAGE_TOO_LARGE };
  }

  let dimensions: ImageDimensions;
  try {
    dimensions = await getImageDimensions(file);
  } catch (error) {
    return { valid: false, error: ERROR_MESSAGES.IMAGE_DIMENSIONS_FAILED };
  }

  if (dimensions.width < MIN_IMAGE_WIDTH || dimensions.height < MIN_IMAGE_HEIGHT) {
    return { valid: false, error: ERROR_MESSAGES.IMAGE_TOO_SMALL };
  }

  const aspectRatio = dimensions.width / dimensions.height;
  if (aspectRatio < MIN_ASPECT_RATIO || aspectRatio > MAX_ASPECT_RATIO) {
    return { valid: false, error: ERROR_MESSAGES.IMAGE_INVALID_ASPECT };
  }

  return { valid: true, dimensions };
}

// ===========================
// Audio Validation
// ===========================

export interface AudioValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Validate audio file before upload
 * Guards: file exists, size, type
 */
export function validateAudioFile(file: File | null | undefined): AudioValidationResult {
  // Guard 1: File exists
  if (!file) {
    return { valid: false, error: ERROR_MESSAGES.AUDIO_REQUIRED };
  }

  // Guard 2: File type
  if (!file.type?.startsWith('audio/')) {
    return { valid: false, error: ERROR_MESSAGES.AUDIO_INVALID_TYPE };
  }

  // Guard 3: File size
  if (file.size > MAX_AUDIO_SIZE_BYTES) {
    return { valid: false, error: ERROR_MESSAGES.AUDIO_TOO_LARGE };
  }

  return { valid: true };
}

// ===========================
// Audio Recording Utilities
// ===========================

export interface AudioFormat {
  mimeType: string;
  extension: string;
}

/**
 * Get the best supported audio format for recording
 */
export function getSupportedAudioFormat(): AudioFormat {
  if (typeof window === 'undefined' || !('MediaRecorder' in window)) {
    return { mimeType: '', extension: 'webm' };
  }

  for (const candidate of AUDIO_FORMAT_CANDIDATES) {
    if (MediaRecorder.isTypeSupported(candidate.mimeType)) {
      return { ...candidate };
    }
  }

  // Fallback
  return { mimeType: '', extension: 'webm' };
}

/**
 * Check if MediaRecorder is supported
 */
export function isMediaRecorderSupported(): boolean {
  return typeof window !== 'undefined' && 'MediaRecorder' in window;
}

/**
 * Check if getUserMedia is supported
 */
export function isGetUserMediaSupported(): boolean {
  return typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia;
}

// ===========================
// Object URL Management
// ===========================

/**
 * Safely create and manage object URLs
 * Returns URL and cleanup function
 */
export function createObjectURL(blob: Blob | File): { url: string; cleanup: () => void } {
  const url = URL.createObjectURL(blob);
  const cleanup = () => URL.revokeObjectURL(url);
  return { url, cleanup };
}

/**
 * Safely revoke an object URL if it's valid
 */
export function safeRevokeObjectURL(url: string | null | undefined): void {
  if (url && (url.startsWith('blob:') || url.startsWith('data:'))) {
    try {
      URL.revokeObjectURL(url);
    } catch (error) {
      // Ignore errors during cleanup
      console.warn('Failed to revoke object URL:', error);
    }
  }
}
