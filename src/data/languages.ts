/** Common languages for multi-select on register. */
export const LANGUAGE_NAMES: string[] = [
  'Arabic',
  'Bengali',
  'Chinese',
  'Czech',
  'Danish',
  'Dutch',
  'English',
  'Finnish',
  'French',
  'German',
  'Greek',
  'Hebrew',
  'Hindi',
  'Hungarian',
  'Indonesian',
  'Italian',
  'Japanese',
  'Korean',
  'Malay',
  'Norwegian',
  'Polish',
  'Portuguese',
  'Romanian',
  'Russian',
  'Spanish',
  'Swedish',
  'Tagalog',
  'Thai',
  'Turkish',
  'Ukrainian',
  'Vietnamese',
];

export function filterLanguages(query: string, selected: string[], limit = 12): string[] {
  const q = query.trim().toLowerCase();
  const selectedLower = new Set(selected.map((l) => l.toLowerCase()));
  const pool = LANGUAGE_NAMES.filter((name) => !selectedLower.has(name.toLowerCase()));
  if (!q) return pool.slice(0, limit);
  return pool.filter((name) => name.toLowerCase().includes(q)).slice(0, limit);
}
