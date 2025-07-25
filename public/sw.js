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

if ('PushManager' in window) {
    navigator.serviceWorker.ready
        .then(reg => reg.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
        }));
} else {
    console.warn('Push API not supported; you may need a fallback.');
}