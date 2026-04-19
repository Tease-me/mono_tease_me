
export const CREDIT_CONVERSION_RATE = {
  centsPerUsd: 100,
  creditsPerUsd: 60,
} as const;

/**
 * Converts an amount in cents to dollars.
 * @param cents Amount in cents
 * @returns Amount in dollars
 */
export function centsToDollars(cents: number): number {
  return cents / CREDIT_CONVERSION_RATE.centsPerUsd;
}

/**
 * Converts an amount in cents to credits using the backend's fixed rate.
 * @param cents Amount in cents
 * @returns Whole-number credits
 */
export function centsToCredits(cents: number): number {
  return Math.round(
    (cents * CREDIT_CONVERSION_RATE.creditsPerUsd) /
      CREDIT_CONVERSION_RATE.centsPerUsd,
  );
}

/**
 * Formats an amount in cents into a dollar string (e.g., $1.23).
 * @param cents Amount in cents
 * @param locale Locale for formatting, defaults to 'en-US'
 * @param currency Currency code, defaults to 'USD'
 * @returns Formatted currency string
 */
export function formatCentsToDollars(
  cents: number,
  locale: string = "en-US",
  currency: string = "USD",
): string {
  const dollars = centsToDollars(cents);
  return new Intl.NumberFormat(locale, { style: "currency", currency }).format(
    dollars,
  );
}

/**
 * Formats a credit balance for compact badge-style display.
 * @param credits Credit amount
 * @returns Formatted credit badge text
 */
export function formatCredits(credits: number | null | undefined): string {
  const wholeCredits = Math.max(0, Math.round(credits ?? 0));
  return `♦${wholeCredits}`;
}
