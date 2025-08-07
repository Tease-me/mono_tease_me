window.global ||= window;
import React from 'react'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import AppRoutes from './routes/AppRoutes.jsx'
import { AuthProvider } from './context/AuthContext'
import logger from './utils/logger';

function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    (async () => {
      try {
        const registration = await navigator.serviceWorker.register(
          "/sw.js",
          { type: 'module' }
        );
        logger.info('ServiceWorker Successfully registered! 🎉', registration)
      } catch (error) {
        logger.error('Failed to subscribe the user:', error);
      }
    })();
  } else {
    logger.error('Service Worker or Push API not supported.');
  }
}

const rootElement = document.getElementById('root');
if (rootElement) {
  registerServiceWorker();
  createRoot(rootElement).render(
    <StrictMode>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </StrictMode>,
  );
} else {
  throw new Error("Root element not found");
}