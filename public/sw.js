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