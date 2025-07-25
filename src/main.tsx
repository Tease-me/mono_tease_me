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

function urlBase64ToUint8Array(base64String: string | any[]) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0)));
}

if ("serviceWorker" in navigator && "PushManager" in window) {
  try {
    const registration = await navigator.serviceWorker.register("/sw.js");

    const serviceWorkerRegistration = await navigator.serviceWorker.ready;

    const subscription =
      await serviceWorkerRegistration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(
          FIREBASE_PUBLIC_KEY
        ),
      });
    const auth_token = storage.get(LocalStorageKeys.AccessToken);
    if (auth_token) {
      await SubscribePushNotification(subscription, auth_token)
      console.log("Subscription:", subscription);
      console.log("Successfully subscribed to push notifications! 🎉");
    } else {
      console.log("Log in to Subscribe to notifications");
    }
  } catch (error) {
    console.error("Failed to subscribe the user:", error);
  }
} else {
  console.error("Service Worker or Push API not supported.");
}
