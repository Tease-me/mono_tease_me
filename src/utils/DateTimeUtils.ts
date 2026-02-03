/**
 * Returns a human‐readable relative date/time string for the given input.
 * - “X seconds ago”, “Y minutes ago”, “Z hours ago”, “N days ago”
 * - If older than 30 days but within current year: “D MMM” (e.g. “14 Feb”)
 * - If in previous years: “D MMM YYYY” (e.g. “14 Feb 2024”)
 */
export function formatDateTimeRelative(input: string | Date): string {
    const date = typeof input === 'string' ? new Date(input) : input;
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHrs = Math.floor(diffMin / 60);
    const diffDays = Math.floor(diffHrs / 24);

    if (diffMin < 1) {
        return `${diffSec} second${diffSec !== 1 ? 's' : ''} ago`;
    }
    if (diffHrs < 1) {
        return `${diffMin} minute${diffMin !== 1 ? 's' : ''} ago`;
    }
    if (diffHrs < 12) {
        return date.toLocaleTimeString('default', { hour: 'numeric', minute: '2-digit' });
    }
    if (diffDays < 1) {
        return `${diffHrs} hour${diffHrs !== 1 ? 's' : ''} ago`;
    }
    if (diffDays < 30) {
        return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`;
    }

    const day = date.getDate();
    const month = date.toLocaleString('default', { month: 'short' }); // e.g. "Feb"  [oai_citation:0‡MDN Web Docs](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/RelativeTimeFormat)
    const year = date.getFullYear();
    const isCurrentYear = year === now.getFullYear();
    return `${day} ${month}${isCurrentYear ? '' : ` ${year}`}`;
}

export function secondsToMinutes(seconds: number): number {
    if (!Number.isFinite(seconds)) return 0;
    return seconds / 60;
}

export function minutesToTime(minutes: number) {
    if (!Number.isFinite(minutes)) return "0:00";

    const mins = Math.floor(minutes);
    const secs = Math.round((minutes - mins) * 60);

    if (secs === 60) {
        return `${mins + 1}:00`;
    }

    return `${mins}:${secs.toString().padStart(2, "0")}`;
}
