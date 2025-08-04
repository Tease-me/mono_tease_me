import React from 'react'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import AppRoutes from './routes/AppRoutes.jsx'
import { AuthProvider } from './context/AuthContext'
import { FIREBASE_PUBLIC_KEY } from '@/env'

import { useEffect } from 'react';
import { apiClient } from './api/apis'

function usePushNotifications() {
  console.log("UsePushNotification!")
  useEffect(() => {
    if ('serviceWorker' in navigator && 'PushManager' in window) {
      console.log('Found Service Worker and PushManager');
      (async () => {
        try {
          const registration = await navigator.serviceWorker.register(
            new URL('./service-worker.js', import.meta.url),
            { type: 'module' }
          );

          console.log('Service Worker registered:', registration);
          // const ready = await navigator.serviceWorker.ready;
          // console.log("ready", ready);
          let subscription = await registration.pushManager.getSubscription();
          if (!subscription) {
            subscription = await registration.pushManager.subscribe({
              userVisibleOnly: true,
              applicationServerKey: FIREBASE_PUBLIC_KEY
            });
          }
          console.log('Successfully subscribed in the front end! 🎉');
          await apiClient.post("/push/subscribe",
            JSON.stringify(subscription)
          );

          console.log('Successfully subscribed to push notifications! 🎉');
        } catch (error) {
          console.error('Failed to subscribe the user:', error);
        }
      })();
    } else {
      console.error('Service Worker or Push API not supported.');
    }
  }, []);
}

const PushNotificationInitializer: React.FC = () => {
  usePushNotifications();
  return null;
};

const rootElement = document.getElementById('root');
if (rootElement) {
  createRoot(rootElement).render(
    <StrictMode>
      <AuthProvider>
        <PushNotificationInitializer />
        <AppRoutes />
      </AuthProvider>
    </StrictMode>,
  );
} else {
  throw new Error("Root element not found");
}