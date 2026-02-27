// File Upload Hook with Validation Guards
// Handles image and audio file uploads with comprehensive validation

import { useCallback } from 'react';
import { apiClient } from '@/api/apis';
import {
  validateImageFile,
  validateAudioFile,
  createObjectURL,
} from '@/ui/screens/influencer-survey/utils/fileUploadHelpers';
import { ERROR_MESSAGES } from '@/ui/screens/influencer-survey/utils/constants';

interface UploadImageParams {
  file: File;
  preInfluencerId: number;
  token: string;
  temp_password: string;
}

interface UploadImageResult {
  success: boolean;
  s3_key?: string;
  error?: string;
  localPreviewUrl?: string;
}

interface UploadAudioParams {
  file: File;
  influencerId: number;
  token?: string;
  temp_password?: string;
}

interface UploadAudioResult {
  success: boolean;
  error?: string;
}

/**
 * Hook for handling file uploads with validation
 */
export function useFileUpload() {
  /**
   * Validate and upload profile picture
   * All guards applied before upload
   */
  const uploadProfilePicture = useCallback(
    async ({
      file,
      preInfluencerId,
      token,
      temp_password,
    }: UploadImageParams): Promise<UploadImageResult> => {
      // Validate file with all guards
      const validation = await validateImageFile(file);

      if (!validation.valid) {
        return {
          success: false,
          error: validation.error || ERROR_MESSAGES.IMAGE_UPLOAD_FAILED,
        };
      }

      // Create local preview URL (will be shown while uploading)
      const { url: localPreviewUrl, cleanup } = createObjectURL(file);

      try {
        // Upload to server
        const formData = new FormData();
        formData.append('file', file);
        formData.append('pre_influencer_id', String(preInfluencerId));

        const { data } = await apiClient.post('/pre-influencers/upload-picture', formData, {
          params: { token, temp_password },
          headers: { 'Content-Type': 'multipart/form-data' },
        });

        return {
          success: true,
          s3_key: data.s3_key,
          localPreviewUrl, // Return for temporary display
        };
      } catch (error) {
        console.error('Picture upload failed:', error);
        cleanup(); // Clean up object URL on error
        return {
          success: false,
          error: ERROR_MESSAGES.IMAGE_UPLOAD_FAILED,
        };
      }
    },
    []
  );

  /**
   * Validate and upload audio file
   * All guards applied before upload
   */
  const uploadAudioFile = useCallback(
    async ({
      file,
      influencerId,
      token,
      temp_password,
    }: UploadAudioParams): Promise<UploadAudioResult> => {
      // Validate file with all guards
      const validation = validateAudioFile(file);

      if (!validation.valid) {
        return {
          success: false,
          error: validation.error || ERROR_MESSAGES.AUDIO_UPLOAD_FAILED,
        };
      }

      try {
        // Upload to server
        const formData = new FormData();
        formData.append('file', file);

        const headers: Record<string, string> = {
          'Content-Type': 'multipart/form-data',
        };

        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        }

        await apiClient.post(`/influencer/influencer-audio/${influencerId}`, formData, {
          headers,
          params: token ? { token, temp_password } : undefined,
        });

        return { success: true };
      } catch (error) {
        console.error('Audio upload failed:', error);
        return {
          success: false,
          error: ERROR_MESSAGES.AUDIO_UPLOAD_FAILED,
        };
      }
    },
    []
  );

  /**
   * Delete audio file
   */
  const deleteAudioFile = useCallback(
    async ({
      influencerId,
      key,
      token,
      temp_password,
    }: {
      influencerId: number;
      key: string;
      token?: string;
      temp_password?: string;
    }): Promise<{ success: boolean; error?: string }> => {
      try {
        await apiClient.delete(`/pre-influencers/influencer-audio/${influencerId}`, {
          data: { key },
          params: token ? { token, temp_password } : undefined,
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        });

        return { success: true };
      } catch (error) {
        console.error('Audio delete failed:', error);
        return {
          success: false,
          error: ERROR_MESSAGES.AUDIO_DELETE_FAILED,
        };
      }
    },
    []
  );

  return {
    uploadProfilePicture,
    uploadAudioFile,
    deleteAudioFile,
  };
}
