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
      <Provider store={store}>
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <ErrorModalProvider />
            <AppRoutes />
          </AuthProvider>
        </QueryClientProvider>
      </Provider>
    </StrictMode>,
  );
} else {
  throw new Error("Root element not found");
}
