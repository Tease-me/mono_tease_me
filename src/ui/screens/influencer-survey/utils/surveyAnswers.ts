/** Profile picture presigned URLs must not be stored as the user asset link. */
export function isInferredProfilePictureLink(value: unknown): boolean {
  if (typeof value !== 'string' || !value.trim()) return false;
  try {
    const url = new URL(value.trim());
    if (!url.hostname.includes('amazonaws.com')) return false;
    return (
      /\/profile\.(png|jpe?g|webp)$/i.test(url.pathname) ||
      /\/influencers\/[^/]+\/profile\./i.test(url.pathname)
    );
  } catch {
    return false;
  }
}

/** Clears backend-derived picture URLs mistakenly returned as asset_link. */
export function normalizeLoadedSurveyAnswers(
  answers: Record<string, unknown>
): Record<string, unknown> {
  const next = { ...answers };
  if (isInferredProfilePictureLink(next.asset_link)) {
    delete next.asset_link;
  }
  return next;
}

/**
 * Prepares survey_answers for PUT. Only includes asset_link when the user
 * provided a real external link (not empty, not a profile presigned URL).
 */
export function surveyAnswersForApi(
  answers: Record<string, unknown>
): Record<string, unknown> {
  const next = { ...answers };
  const raw = answers.asset_link;

  if (typeof raw !== 'string') {
    delete next.asset_link;
    return next;
  }

  const trimmed = raw.trim();
  if (!trimmed || isInferredProfilePictureLink(trimmed)) {
    delete next.asset_link;
    return next;
  }

  next.asset_link = trimmed;
  return next;
}

export type SurveySaveBody = {
  survey_answers: Record<string, unknown>;
  survey_step: number;
  asset_link?: string;
};

export function buildSurveySaveBody(
  answers: Record<string, unknown>,
  currentStep: number
): SurveySaveBody {
  const survey_answers = surveyAnswersForApi(answers);
  const body: SurveySaveBody = { survey_answers, survey_step: currentStep };
  const link = survey_answers.asset_link;
  if (typeof link === 'string' && link) {
    body.asset_link = link;
  }
  return body;
}
