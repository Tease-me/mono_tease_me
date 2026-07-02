import { APP_VERSION } from "@/version";
import logger from "@/utils/logger";

const VERSION_CHECK_INTERVAL_MS = 5 * 60 * 1000;
const VERSION_RELOAD_FLAG_KEY = "tease-me:version-reload-target";

async function fetchLatestVersion(): Promise<string | null> {
  try {
    const response = await fetch(`/version.json?ts=${Date.now()}`, {
      cache: "no-store",
    });

    if (!response.ok) {
      return null;
    }

    const payload = (await response.json()) as { version?: unknown };
    return typeof payload.version === "string" ? payload.version : null;
  } catch {
    return null;
  }
}

export function clearVersionReloadFlag(): void {
  sessionStorage.removeItem(VERSION_RELOAD_FLAG_KEY);
}

async function checkForNewVersion(source: string): Promise<void> {
  const latestVersion = await fetchLatestVersion();

  if (!latestVersion || latestVersion === APP_VERSION) {
    clearVersionReloadFlag();
    return;
  }

  const reloadTarget = sessionStorage.getItem(VERSION_RELOAD_FLAG_KEY);
  if (reloadTarget === latestVersion) {
    logger.warn(
      "New app version detected (%s -> %s) via %s, but reload was already attempted",
      APP_VERSION,
      latestVersion,
      source,
    );
    return;
  }

  sessionStorage.setItem(VERSION_RELOAD_FLAG_KEY, latestVersion);
  logger.info(
    "New app version detected (%s -> %s) via %s, reloading",
    APP_VERSION,
    latestVersion,
    source,
  );
  window.location.reload();
}

export function setupVersionPolling(): void {
  if (!import.meta.env.PROD) {
    return;
  }

  void checkForNewVersion("startup");

  window.setInterval(() => {
    void checkForNewVersion("interval");
  }, VERSION_CHECK_INTERVAL_MS);

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
      void checkForNewVersion("visibility");
    }
  });
}
