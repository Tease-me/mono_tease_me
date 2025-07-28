import { FIREBASE_PUBLIC_KEY } from "./api/env";

self.addEventListener('push', event => {
    console.log("Push received:", event);
    const data = event.data.json();
    event.waitUntil(
        self.registration.showNotification('Title', {
            body: data.message,
            icon: '/apple-touch-icon.png'
        })
    );
});

if ('PushManager' in self) {
    self.registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: FIREBASE_PUBLIC_KEY
    });
} else {
    console.warn('Push API not supported; you may need a fallback.');
}