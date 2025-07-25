import { LocalStorageKeys } from "@/constants/localStorageKeys";

export const storage = {
    get: (key: LocalStorageKeys): string | null =>
        window.localStorage.getItem(key),

    set: (key: LocalStorageKeys, value: string): void =>
        window.localStorage.setItem(key, value),

    remove: (key: LocalStorageKeys): void =>
        window.localStorage.removeItem(key),

    setObject: (key: LocalStorageKeys, value: unknown): void =>
        window.localStorage.setItem(key, JSON.stringify(value)),

    getObject: <T>(key: LocalStorageKeys): T | undefined => {
        const item = window.localStorage.getItem(key);
        if (!item) return undefined;
        try {
            return JSON.parse(item) as T;
        } catch {
            console.error(`Error parsing JSON from localStorage for key ${key}`);
            return undefined;
        }
    },

    clear: (): void =>
        window.localStorage.clear(),
};