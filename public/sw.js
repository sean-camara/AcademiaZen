// public/sw.js

/* =========================
   INSTALL & ACTIVATE
========================= */

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

/* =========================
   PUSH NOTIFICATIONS (FCM)
========================= */

self.addEventListener('push', (event) => {
  if (!event.data) return;

  let payload = {};
  try {
    payload = event.data.json();
  } catch {
    payload = { title: 'Notification', body: event.data.text() };
  }

  const title = payload.title || '📚 AcademiaZen Reminder';
  const options = {
    body: payload.body || 'You have an upcoming task.',
    icon: '/pwa-192x192.png',
    badge: '/pwa-192x192.png',
    vibrate: [300, 100, 300],
    data: {
      url: payload.url || '/'
    },
    tag: payload.tag || 'academiazen-notification',
    renotify: true
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

/* =========================
   NOTIFICATION CLICK
========================= */

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const targetUrl = event.notification.data?.url || '/';

  event.waitUntil(
    self.clients.matchAll({
      type: 'window',
      includeUncontrolled: true
    }).then((windowClients) => {
      for (const client of windowClients) {
        if (client.url === targetUrl && 'focus' in client) {
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});
