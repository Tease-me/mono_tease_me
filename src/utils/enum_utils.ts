/**
 * Count the number of members in a TypeScript enum.
 * Works for both numeric and string enums.
 */
export const enumLength = (e: object): number => {
    const values = Object.values(e);
    // Numeric enums have reverse mappings; count only numeric values.
    return values.some(v => typeof v === "number")
        ? values.filter(v => typeof v === "number").length
        : values.length;
};

/**
 * Pick a random value from a TS enum in a type-safe way.
 * Usage (inference):    getRandomEnumValue(AccountStatus)
 * Usage (explicit):     getRandomEnumValue<typeof AccountStatus>(AccountStatus)
 */
export const getRandomEnumValue = <T extends Record<string, string | number>>(e: T): T[keyof T] => {
    const vals = Object.values(e);
    // Numeric enums have reverse mappings; filter to the numeric side.
    const base = vals.some(v => typeof v === "number")
        ? vals.filter(v => typeof v === "number")
        : vals;
    const arr = base as T[keyof T][];
    return arr[Math.floor(Math.random() * arr.length)];
};