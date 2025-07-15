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
export const BLAND_AGENT_LUNA = getEnvVar('VITE_BLAND_AGENT_LUNA');
export const BLAND_AGENT_TEST = getEnvVar('VITE_BLAND_AGENT_TEST');


export const TEASE_ME_PROTOCOL = getEnvVar('VITE_TEASE_ME_PROTOCOL');
export const TEASE_ME_HOST = getEnvVar('VITE_TEASE_ME_HOST');