window.global ||= window;
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { AuthProvider } from "./context/AuthContext";
import ErrorModalProvider from "./ui/components/modals/ErrorModalProvider";
import "./index.css";
import AppRoutes from "./routes/AppRoutes.jsx";
import logger from "./utils/logger";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Provider } from "react-redux";
import { store } from "./store/store";

function registerServiceWorker() {
  if ("serviceWorker" in navigator) {
    (async () => {
      try {
        const registration = await navigator.serviceWorker.register("/sw.js", {
          type: "module",
        });
        logger.info("ServiceWorker Successfully registered! 🎉", registration);
      } catch (error) {
        logger.error("Failed to subscribe the user:", error);
      }
    })();
  } else {
    logger.error("Service Worker or Push API not supported.");
  }
}

const rootElement = document.getElementById("root");
const queryClient = new QueryClient();

if (rootElement) {
  if (import.meta.env.PROD) {
    registerServiceWorker();
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
