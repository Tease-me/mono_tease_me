window.global ||= window;
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

posthog.init(import.meta.env.VITE_PUBLIC_POSTHOG_PROJECT_TOKEN, {
  api_host: import.meta.env.VITE_PUBLIC_POSTHOG_HOST,
  defaults: "2026-01-30",
});

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

if (rootElement) {
  if (import.meta.env.PROD) {
    cleanupPwaArtifacts();
  }
  createRoot(rootElement).render(
    <StrictMode>
      <PostHogProvider client={posthog}>
        <PostHogErrorBoundary>
          <Provider store={store}>
            <QueryClientProvider client={queryClient}>
              <AuthProvider>
                <ErrorModalProvider />
                <AppRoutes />
              </AuthProvider>
            </QueryClientProvider>
          </Provider>
        </PostHogErrorBoundary>
      </PostHogProvider>
    </StrictMode>,
  );
} else {
  throw new Error("Root element not found");
}
