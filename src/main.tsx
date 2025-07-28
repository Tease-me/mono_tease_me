import React from 'react'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import AppRoutes from './AppRoutes.jsx'
import { AuthProvider } from './context/AuthContext'
import { storage } from './utils/storage'
import { LocalStorageKeys } from './constants/localStorageKeys'
import { FIREBASE_PUBLIC_KEY } from './api/env'

const rootElement = document.getElementById('root');
if (rootElement) {
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

export const SubscribePushNotification = async (subscription: PushSubscription, auth_token: string) => {
  await fetch(`https://6481b474c8b3.ngrok-free.app/push/subscribe`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${auth_token}`,
    },
    body: JSON.stringify(subscription),
  });
}

(async () => {
  if ('serviceWorker' in navigator && 'PushManager' in window) {
    try {
      // 1. Register the service worker as a module
      const registration = await navigator.serviceWorker.register(
        new URL('./service-worker.js', import.meta.url),
        { type: 'module' }
      );
      console.log('Service Worker registered:', registration);

      // 2. Wait until the service worker is active
      await navigator.serviceWorker.ready;

      // 3. Get or create a push subscription
      let subscription = await registration.pushManager.getSubscription();
      if (!subscription) {
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: FIREBASE_PUBLIC_KEY
        });
      }

      // 4. Send the subscription to your backend
      const auth_token = storage.get(LocalStorageKeys.AccessToken);
      if (auth_token) {
        await SubscribePushNotification(subscription, auth_token);
        console.log('Successfully subscribed to push notifications! 🎉');
      } else {
        console.log('Log in to Subscribe to notifications');
      }
    } catch (error) {
      console.error('Failed to subscribe the user:', error);
    }
  } else {
    console.error('Service Worker or Push API not supported.');
  }
})();
