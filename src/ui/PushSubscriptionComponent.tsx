import { useEffect } from "react";

function urlBase64ToUint8Array(base64String: string | any[]) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0)));
}

export default function PushSubscriptionComponent() {
  useEffect(() => {
    navigator.serviceWorker.addEventListener("message", (event) => {
      console.log("Nova mensagem recebida via service worker:", event.data);
    });
  }, []);

  useEffect(() => {
    async function subscribeUser() {
      if ("serviceWorker" in navigator && "PushManager" in window) {
        try {
          const registration = await navigator.serviceWorker.register("/sw.js");

          // Ensure service worker is ready and activated
          const serviceWorkerRegistration = await navigator.serviceWorker.ready;

          const subscription =
            await serviceWorkerRegistration.pushManager.subscribe({
              userVisibleOnly: true,
              applicationServerKey: urlBase64ToUint8Array(
                "BAZo5k89iWB3zrczgKJx2iirfr1V5Qi1277tj46hNnleOuADW8pvm3Obf-CQnAwmnL1TsQmVrNmRCyuu7clBNMw"
              ),
            });

          console.log("Subscription:", subscription);

          // Automatically send subscription to backend
          await fetch("/push/subscribe", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIyIiwiZXhwIjoxNzUzNDk0MTQxfQ.aGOri89fB3vxhLcxAl_rW9DUwTXv03srpSrcvXnVQWs`,
            },
            body: JSON.stringify(subscription),
          });

          console.log("Successfully subscribed to push notifications! 🎉");
        } catch (error) {
          console.error("Failed to subscribe the user:", error);
        }
      } else {
        console.error("Service Worker or Push API not supported.");
      }
    }

    subscribeUser();
  }, []);

  return null;
}
