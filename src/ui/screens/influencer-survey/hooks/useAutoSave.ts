// Auto-Save Hook with Dirty Tracking
// Saves survey progress with debouncing and dirty flag management

import { useEffect, useRef } from 'react';
import { apiClient } from '@/api/apis';
import { AUTO_SAVE_DEBOUNCE_MS } from '../utils/constants';

interface UseAutoSaveProps {
  preInfluencerId: number | null;
  answers: Record<string, any>;
  currentStep: number;
  isDirty: boolean;
  token: string;
  temp_password: string;
  onSaveStart: () => void;
  onSaveComplete: () => void;
  onSaveError: (error: any) => void;
}

/**
 * Auto-save hook with improved dirty tracking
 * Only saves when data has actually changed
 * Debounces saves to reduce API calls
 */
export function useAutoSave({
  preInfluencerId,
  answers,
  currentStep,
  isDirty,
  token,
  temp_password,
  onSaveStart,
  onSaveComplete,
  onSaveError,
}: UseAutoSaveProps) {
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastSavedRef = useRef<{
    answers: Record<string, any>;
    step: number;
  }>({
    answers: {},
    step: 0,
  });
  const isSavingRef = useRef(false);
  const saveInProgressRef = useRef<Promise<void> | null>(null);

  useEffect(() => {
    // Skip if no influencer ID or not dirty
    if (!preInfluencerId || !isDirty) return;

    // Skip if currently saving
    if (isSavingRef.current) return;

    // Skip if nothing changed (deep comparison)
    const answersChanged =
      JSON.stringify(lastSavedRef.current.answers) !== JSON.stringify(answers);
    const stepChanged = lastSavedRef.current.step !== currentStep;

    if (!answersChanged && !stepChanged) {
      return;
    }

    // Clear existing timeout
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    // Debounce: wait for inactivity before saving
    saveTimeoutRef.current = setTimeout(async () => {
      const savePromise = (async () => {
        try {
          isSavingRef.current = true;
          onSaveStart();

          await apiClient.put(
            `/pre-influencers/${preInfluencerId}/survey`,
            {
              survey_answers: answers,
              survey_step: currentStep,
            },
            {
              params: { token, temp_password },
            }
          );

          // Update last saved reference
          lastSavedRef.current = {
            answers: { ...answers },
            step: currentStep,
          };

          onSaveComplete();
        } catch (error) {
          console.error('Auto-save failed:', error);
          onSaveError(error);
        } finally {
          isSavingRef.current = false;
          saveInProgressRef.current = null;
        }
      })();

      saveInProgressRef.current = savePromise;
      await savePromise;
    }, AUTO_SAVE_DEBOUNCE_MS);

    // Cleanup timeout on unmount or deps change
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [
    preInfluencerId,
    answers,
    currentStep,
    isDirty,
    token,
    temp_password,
    onSaveStart,
    onSaveComplete,
    onSaveError,
  ]);

  /**
   * Manually trigger a save (for Next/Back buttons)
   * Returns a promise that resolves when save is complete
   * Waits for any in-progress auto-save to complete first
   */
  const saveNow = async (): Promise<void> => {
    if (!preInfluencerId) return;

    // Clear any pending auto-save timeout
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = null;
    }

    // Wait for any in-progress save to complete
    if (saveInProgressRef.current) {
      try {
        await saveInProgressRef.current;
      } catch {
        // Ignore errors from auto-save, we'll try manual save anyway
      }
    }

    // Perform manual save
    const savePromise = (async () => {
      try {
        isSavingRef.current = true;
        onSaveStart();

        await apiClient.put(
          `/pre-influencers/${preInfluencerId}/survey`,
          {
            survey_answers: answers,
            survey_step: currentStep,
          },
          {
            params: { token, temp_password },
          }
        );

        // Update last saved reference
        lastSavedRef.current = {
          answers: { ...answers },
          step: currentStep,
        };

        onSaveComplete();
      } catch (error) {
        console.error('Manual save failed:', error);
        onSaveError(error);
        throw error; // Re-throw so caller knows save failed
      } finally {
        isSavingRef.current = false;
        saveInProgressRef.current = null;
      }
    })();

    saveInProgressRef.current = savePromise;
    await savePromise;
  };

  return { saveNow };
}
