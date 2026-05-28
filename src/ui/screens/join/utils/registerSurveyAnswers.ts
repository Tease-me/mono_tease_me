import { SOCIAL_PLATFORMS } from '@/ui/screens/influencer-survey/utils/constants';

export type RegisterSocialAnswers = Record<string, unknown>;

export function buildRegisterSurveyAnswers(params: {
  country: string;
  username: string;
  languages: string[];
  socialAnswers: RegisterSocialAnswers;
}): Record<string, unknown> {
  const { country, username, languages, socialAnswers } = params;
  const primary = languages[0]?.trim() ?? '';
  const secondary = languages[1]?.trim();

  const base: Record<string, unknown> = {
    q4_country: country,
    q3_social_name: username,
    q5_main_language: primary,
    q5_languages: languages.join(', '),
    ...(secondary ? { q6_secondary_language: secondary } : {}),
  };

  const merged: Record<string, unknown> = { ...base };

  for (const [key, value] of Object.entries(socialAnswers)) {
    if (key.startsWith('social_')) {
      merged[key] = value;
    }
  }

  const selected = new Set<string>(
    Array.isArray(merged.social_selected_platforms)
      ? (merged.social_selected_platforms as string[])
      : []
  );

  for (const platform of SOCIAL_PLATFORMS) {
    const handle = merged[`social_${platform}`];
    if (handle != null && String(handle).trim()) {
      selected.add(platform);
    }
  }

  if (selected.size > 0) {
    merged.social_selected_platforms = [...selected];
  }

  return merged;
}

export function validateRegisterEmail(email: string, inviteeEmail?: string): string | undefined {
  const normalized = email.trim().toLowerCase();
  if (!normalized) return 'Email is required';
  if (!inviteeEmail?.trim()) {
    return 'Registration requires an invite link with a valid email.';
  }
  if (normalized !== inviteeEmail.trim().toLowerCase()) {
    return 'Email must match your invitation.';
  }
  return undefined;
}
