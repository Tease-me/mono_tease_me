export function getEnvVar(key: string): string {
    const value = import.meta.env[key]
    if (!value) {
        throw new Error(`Missing environment variable: ${key}`)
    }
    return value
}

export const BLAND_API_KEY = getEnvVar('VITE_NEXT_PUBLIC_BLAND_API_KEY')
export const BLAND_API_URL = getEnvVar('VITE_BLAND_API_URL');
export const BLAND_WEB_URL = getEnvVar('VITE_BLAND_WEB_URL');
