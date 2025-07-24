

/**
 * Truncates the last name segment of a full name string to maxLength characters,
 * appending '...' if the last name exceeds that length.
 *
 * @param fullName - The full name containing at least one segment.
 * @param maxLength - The maximum allowed length for the last name.
 * @returns The name with its last segment truncated as needed.
 */
export function truncateLastName(fullName: string, maxLength: number = 1): string {
    const nameParts = fullName.trim().split(/\s+/);
    if (nameParts.length === 0) {
        return '';
    }
    // Handle single-word names
    if (nameParts.length === 1) {
        const single = nameParts[0];
        return single.length > maxLength
            ? single.slice(0, maxLength) + '.'
            : single;
    }
    // Truncate the last segment
    const lastName = nameParts.pop()!;
    const truncated = lastName.length > maxLength
        ? lastName.slice(0, maxLength) + '.'
        : lastName;
    // Reassemble the full name
    return [...nameParts, truncated].join(' ');
}

/**
 * Wraps any substring surrounded by asterisks (e.g. *wink*) in <em> tags.
 * Escaped asterisks (\*) are kept literal.
 *
 * Example: italicizeStarActions("She *winks* at you") -> "She <em>winks</em> at you"
 */
export function italicizeStarActions(text: string): string {
    if (!text) return '';
    const ESC = '__AST_ESC__';

    // Protect escaped asterisks \*
    let safe = text.replace(/\\\*/g, ESC);

    // Replace *...* with <em>...</em>
    safe = safe.replace(/\*([^*]+)\*/g, '<em>$1</em>');

    // Restore escaped asterisks
    return safe.replace(new RegExp(ESC, 'g'), '*');
}