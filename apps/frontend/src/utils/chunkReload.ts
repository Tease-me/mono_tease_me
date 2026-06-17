import logger from "@/utils/logger";

const RELOAD_FLAG_KEY = "tease-me:chunk-reload";

function errorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error ?? "");
}

export function isStaleChunkError(error: unknown): boolean {
  const message = errorMessage(error).toLowerCase();
  return (
    message.includes("failed to fetch dynamically imported module") ||
    message.includes("importing a module script failed") ||
    message.includes("error loading dynamically imported module")
  );
}

function reloadForStaleChunk(source: string): void {
  if (sessionStorage.getItem(RELOAD_FLAG_KEY) === "1") {
    logger.warn("Stale JS chunk detected (%s) but reload was already attempted", source);
    return;
  }

  sessionStorage.setItem(RELOAD_FLAG_KEY, "1");
  logger.info("Reloading app after stale JS chunk (%s)", source);
  window.location.reload();
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
    if (!isStaleChunkError(event.reason)) {
      return;
    }
    event.preventDefault();
    reloadForStaleChunk("unhandledrejection");
  });

  window.addEventListener(
    "error",
    (event) => {
      if (!isStaleChunkError(event.error ?? event.message)) {
        return;
      }
      event.preventDefault();
      reloadForStaleChunk("error");
    },
    true,
  );
}
