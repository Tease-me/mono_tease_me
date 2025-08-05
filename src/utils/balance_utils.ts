

/**
 * Converts an amount in cents to dollars.
 * @param cents Amount in cents
 * @returns Amount in dollars
 */
export function centsToDollars(cents: number): number {
    return cents / 100;
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
    locale: string = 'en-US',
    currency: string = 'USD'
): string {
    const dollars = cents / 100;
    return new Intl.NumberFormat(locale, { style: 'currency', currency }).format(dollars);
}