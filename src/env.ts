export function getEnvVar(key: string): string {
  const value = import.meta.env[key];
  if (!value) {
    throw new Error(`Missing environment variable: ${key}`);
  }
  return value;
}

export function getEnvJSON<T>(key: string): T {
  const json = getEnvVar(key);
  try {
    return JSON.parse(json) as T;
  } catch (err) {
    throw new Error(`Invalid JSON in environment variable ${key}: ${err}`);
  }
}

export type AppEnv = "development" | "staging" | "production";

function parseAppEnv(value: string): AppEnv {
  if (
    value === "development" ||
    value === "staging" ||
    value === "production"
  ) {
    return value;
  }

  throw new Error(
    `Invalid VITE_APP_ENV value: ${value}. Expected development, staging, or production.`,
  );
}

export const APP_ENV = parseAppEnv(getEnvVar("VITE_APP_ENV"));
export const IS_PRODUCTION = APP_ENV === "production";
export const SHOW_TEST_ROUTES = !IS_PRODUCTION;

export const ELEVENLABS_API_KEY = getEnvVar("VITE_ELEVENLABS_API_KEY");
export const ELEVENLABS_AGENT_ID = getEnvVar("VITE_ELEVENLABS_AGENT_ID");

export const TEASE_ME_PROTOCOL = getEnvVar("VITE_TEASE_ME_PROTOCOL");
export const TEASE_ME_HOST = getEnvVar("VITE_TEASE_ME_HOST");
export const TEASE_ME_WS_PROTOCOL = getEnvVar("VITE_TEASE_ME_WS_PROTOCOL");

export const FIREBASE_PUBLIC_KEY = getEnvVar("VITE_FIREBASE_PUBLIC_KEY");
