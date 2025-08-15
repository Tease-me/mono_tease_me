import { LocalStorageKeys } from "@/constants/localStorageKeys";
import logger from "./logger";

export const storage = {
    get: (key: LocalStorageKeys): string | null => window.localStorage.getItem(key),

    set: (key: LocalStorageKeys, value: string): void => window.localStorage.setItem(key, value),

    getNumber: (key: LocalStorageKeys): number | null => {
        const fromStorage = window.localStorage.getItem(key)
        var result = null
        if (fromStorage) {
            try {
                result = parseInt(fromStorage)
            } catch (e) {
                logger.error(e)
            }
        }
        return result
    },

    setNumber: (key: LocalStorageKeys, value: number): void => window.localStorage.setItem(key, value.toString()),

    setBoolean: (key: LocalStorageKeys, value: boolean): void => window.localStorage.setItem(key, value.toString()),

    getBoolean: (key: LocalStorageKeys): boolean => window.localStorage.getItem(key) === "true",

    remove: (key: LocalStorageKeys): void => window.localStorage.removeItem(key),

    setObject: (key: LocalStorageKeys, value: unknown): void => window.localStorage.setItem(key, JSON.stringify(value)),

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