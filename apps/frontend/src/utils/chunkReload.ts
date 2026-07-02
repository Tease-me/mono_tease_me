import logger from "@/utils/logger";

const RELOAD_FLAG_KEY = "tease-me:chunk-reload";

const STALE_CHUNK_MESSAGE_MARKERS = [
  "failed to fetch dynamically imported module",
  "importing a module script failed",
  "error loading dynamically imported module",
  "unable to preload css",
] as const;

export const STALE_CHUNK_IGNORE_ERRORS: Array<string | RegExp> = [
  /failed to fetch dynamically imported module/i,
  /importing a module script failed/i,
  /error loading dynamically imported module/i,
  /unable to preload css/i,
];

function isStaleChunkMessage(message: string): boolean {
  const normalized = message.toLowerCase();
  return STALE_CHUNK_MESSAGE_MARKERS.some((marker) => normalized.includes(marker));
}

function collectErrorMessages(error: unknown, depth = 0, seen = new Set<unknown>()): string[] {
  if (error == null || depth > 4) {
    return [];
  }

  if (typeof error === "string") {
    return [error];
  }

  if (typeof error === "object" || typeof error === "function") {
    if (seen.has(error)) {
      return [];
    }
    seen.add(error);
  }

  if (error instanceof Error) {
    const messages = [error.message];
    if (error.cause !== undefined) {
      messages.push(...collectErrorMessages(error.cause, depth + 1, seen));
    }
    return messages;
  }

  if (Array.isArray(error)) {
    return error.flatMap((item) => collectErrorMessages(item, depth + 1, seen));
  }

  if (typeof error === "object") {
    const record = error as Record<string, unknown>;
    const messages: string[] = [];

    if (typeof record.message === "string") {
      messages.push(record.message);
    }

    for (const key of ["cause", "reason", "error"] as const) {
      if (key in record) {
        messages.push(...collectErrorMessages(record[key], depth + 1, seen));
      }
    }

    return messages;
  }

  return [String(error)];
}

export function isStaleChunkError(error: unknown): boolean {
  return collectErrorMessages(error).some(isStaleChunkMessage);
}

type SentryLikeEvent = {
  message?: string;
  logger?: string;
  exception?: {
    values?: Array<{ value?: string; type?: string } | undefined>;
  };
};

export function shouldSuppressStaleChunkSentryEvent(
  event: SentryLikeEvent,
  originalException: unknown,
): boolean {
  if (isStaleChunkError(originalException)) {
    return true;
  }

  if (isStaleChunkError(event.message)) {
    return true;
  }

  for (const value of event.exception?.values ?? []) {
    if (isStaleChunkError(value?.value) || isStaleChunkError(value?.type)) {
      return true;
    }
  }

  if (event.logger === "console" && isStaleChunkError(originalException)) {
    return true;
  }

  return false;
}

function reloadForStaleChunk(source: string): boolean {
  if (sessionStorage.getItem(RELOAD_FLAG_KEY) === "1") {
    logger.warn("Stale JS chunk detected (%s) but reload was already attempted", source);
    return false;
  }

  sessionStorage.setItem(RELOAD_FLAG_KEY, "1");
  logger.info("Reloading app after stale JS chunk (%s)", source);
  window.location.reload();
  return true;
}

export function tryReloadForStaleChunk(error: unknown, source: string): boolean {
  if (!isStaleChunkError(error)) {
    return false;
  }

  return reloadForStaleChunk(source);
}

export function clearStaleChunkReloadFlag(): void {
  sessionStorage.removeItem(RELOAD_FLAG_KEY);
}

export function setupStaleChunkRecovery(): void {
  if (!import.meta.env.PROD) {
    return;
  }

  window.addEventListener("vite:preloadError", (event) => {
    event.preventDefault();
    reloadForStaleChunk("vite:preloadError");
  });

  window.addEventListener("unhandledrejection", (event) => {
    if (!tryReloadForStaleChunk(event.reason, "unhandledrejection")) {
      return;
    }
    event.preventDefault();
  });

  window.addEventListener(
    "error",
    (event) => {
      if (!tryReloadForStaleChunk(event.error ?? event.message, "error")) {
        return;
      }
      event.preventDefault();
    },
    true,
  );
}
