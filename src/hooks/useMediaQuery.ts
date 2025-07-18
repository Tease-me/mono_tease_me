import { useState, useEffect } from "react";

/**
 * A React hook that returns whether the given media query matches.
 * @param query A CSS media query string, e.g. "(max-width: 768px)"
 */
export default function useMediaQuery(query: string): boolean {
    const [matches, setMatches] = useState(() => {
        if (typeof window !== "undefined") {
            return window.matchMedia(query).matches;
        }
        return false;
    });

    useEffect(() => {
        const mql = window.matchMedia(query);
        const handler = (e: MediaQueryListEvent) => setMatches(e.matches);

        mql.addEventListener("change", handler);
        return () => mql.removeEventListener("change", handler);
    }, [query]);

    return matches;
}