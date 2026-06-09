
/* eslint-disable no-console */

// src/utils/logger.ts
// Simple logger wrapper to control output by environment

// type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const isDev = import.meta.env.DEV;
if (isDev) console.warn('[DEVELOPMENT MODE ACTIVE]');
/**
 * Debug-level logging: only prints in development
 */
export function debug(...args: unknown[]): void {
    if (isDev) {
        console.debug('[DEBUG]', ...args);
    }
}

/**
 * Info-level logging: prints in all environments
 */
export function info(...args: unknown[]): void {
    console.info('[INFO]', ...args);
}

/**
 * Warn-level logging: prints in all environments
 */
export function warn(...args: unknown[]): void {
    console.warn('[WARN]', ...args);
}

/**
 * Error-level logging: prints in all environments
 */
export function error(...args: unknown[]): void {
    console.error('[ERROR]', ...args);
}

/**
 * Group logs together (only groups in dev mode)
 */
export function group(label: string, callback: () => void): void {
    if (isDev) {
        console.group(label);
        callback();
        console.groupEnd();
    } else {
        callback();
    }
}

/**
 * Time a section of code (only in dev mode)
 */
export function time(label: string): void {
    if (isDev) console.time(label);
}

/**
 * End timing
 */
export function timeEnd(label: string): void {
    if (isDev) console.timeEnd(label);
}

/**
 * Default logger namespace
 */
const logger = { debug, info, warn, error, group, time, timeEnd };
export default logger;