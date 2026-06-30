import "./polyfills";
import "@lottiefiles/dotlottie-wc";
import * as Sentry from "@sentry/react";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { AuthProvider } from "./context/AuthContext";
import ErrorModalProvider from "./ui/components/modals/ErrorModalProvider";
import "./index.css";
import AppRoutes from "./routes/AppRoutes";
import logger from "./utils/logger";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Provider } from "react-redux";
import { store } from "./store/store";
import posthog from "posthog-js";
import { PostHogErrorBoundary, PostHogProvider } from "@posthog/react";
import { IS_PRODUCTION } from "./env";
import { APP_VERSION } from "@/version";
import {
  clearStaleChunkReloadFlag,
  isStaleChunkError,
  setupStaleChunkRecovery,
} from "@/utils/chunkReload";
import StaleChunkErrorFallback from "@/ui/components/errors/StaleChunkErrorFallback";

const sentryDsn: string | undefined = import.meta.env.VITE_SENTRY_DSN;

if (import.meta.env.PROD) {
  setupStaleChunkRecovery();
}

function isThirdPartyNoiseError(error: unknown): boolean {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : String(error ?? "");

  return (
    message.includes("EmptyRanges") ||
    message.includes("take ownership of Rust value while it was borrowed")
  );
}

function isDotLottieWasmNoiseEvent(event: Sentry.ErrorEvent): boolean {
  const exceptionValues = event.exception?.values ?? [];
  const messages = exceptionValues.map((value) => value.value ?? "").join("\n");
  if (messages.includes("take ownership of Rust value while it was borrowed")) {
    return true;
  }

  return exceptionValues.some((value) =>
    (value.stacktrace?.frames ?? []).some((frame) => {
      const filename = frame.filename ?? "";
      return (
        filename.includes("lottiefiles/web") ||
        filename.includes("dotlottie-wc") ||
        filename.includes("@lottiefiles")
      );
    }),
  );
}

Sentry.init({
  dsn: sentryDsn,
  enabled: IS_PRODUCTION && Boolean(sentryDsn),
  sendDefaultPii: false,
  ignoreErrors: [
    "Can't find variable: EmptyRanges",
    "attempted to take ownership of Rust value while it was borrowed",
  ],
  denyUrls: [/unpkg\.com\/@lottiefiles/i, /@lottiefiles\/web/i],
  beforeSend(event, hint) {
    if (isDotLottieWasmNoiseEvent(event)) {
      return null;
    }

    const original = hint.originalException;
    if (isStaleChunkError(original) || isStaleChunkError(event.message)) {
      return null;
    }

    if (isThirdPartyNoiseError(original) || isThirdPartyNoiseError(event.message)) {
      return null;
    }

    const exceptionMessage = event.exception?.values?.[0]?.value;
    if (isStaleChunkError(exceptionMessage) || isThirdPartyNoiseError(exceptionMessage)) {
      return null;
    }

    return event;
  },
});

const posthogToken: string | undefined = import.meta.env.VITE_PUBLIC_POSTHOG_PROJECT_TOKEN;
const posthogHost: string | undefined = import.meta.env.VITE_PUBLIC_POSTHOG_HOST;
const posthogEnabled = Boolean(posthogToken && posthogHost);

if (posthogEnabled) {
  posthog.init(posthogToken!, {
    api_host: posthogHost,
    ui_host: "https://us.posthog.com",
    defaults: "2026-01-30",
    opt_out_capturing_by_default: !IS_PRODUCTION,
  });
} else {
  logger.warn("PostHog analytics is disabled: VITE_PUBLIC_POSTHOG_PROJECT_TOKEN or VITE_PUBLIC_POSTHOG_HOST is not set.");
}

function cleanupPwaArtifacts() {
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker
      .getRegistrations()
      .then((registrations) =>
        Promise.all(registrations.map((registration) => registration.unregister())),
      )
      .catch((error) => {
        logger.warn("Failed to unregister service workers:", error);
      });
  }

  if ("caches" in window) {
    caches
      .keys()
      .then((cacheNames) =>
        Promise.all(
          cacheNames
            .filter((cacheName) => cacheName.startsWith("tease-me-"))
            .map((cacheName) => caches.delete(cacheName)),
        ),
      )
      .catch((error) => {
        logger.warn("Failed to clear PWA caches:", error);
      });
  }
}

const rootElement = document.getElementById("root");
const queryClient = new QueryClient();

logger.info(`App version: ${APP_VERSION}`);

if (rootElement) {
  if (import.meta.env.PROD) {
    cleanupPwaArtifacts();
    window.addEventListener("load", clearStaleChunkReloadFlag, { once: true });
  }
  const appTree = (
    <StrictMode>
      <Provider store={store}>
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <ErrorModalProvider />
            <AppRoutes />
          </AuthProvider>
        </QueryClientProvider>
      </Provider>
    </StrictMode>
  );

  const sentryWrappedAppTree = (
    <Sentry.ErrorBoundary
      fallback={({ error }) => (
        <StaleChunkErrorFallback
          error={error}
          fallback={<p>Something went wrong</p>}
        />
      )}
    >
      {appTree}
    </Sentry.ErrorBoundary>
  );

  createRoot(rootElement).render(
    posthogEnabled ? (
      <PostHogProvider client={posthog}>
        <PostHogErrorBoundary>{sentryWrappedAppTree}</PostHogErrorBoundary>
      </PostHogProvider>
    ) : (
      sentryWrappedAppTree
    ),
  );
} else {
  throw new Error("Root element not found");
}
