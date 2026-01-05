const CACHE_NAME = 'zen-cache-v5';
const STATIC_CACHE = 'zen-static-v5';
const DYNAMIC_CACHE = 'zen-dynamic-v5';

// Assets to cache immediately on install
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icons/icon.svg',
  '/icons/icon-192x192.svg',
  '/icons/icon-512x512.svg',
  '/sounds/phone-alert-marimba-bubble-om-fx-1-00-01.mp3',
];

// External resources to cache (will be cached on first use)
const EXTERNAL_ASSETS = [
  'https://cdn.tailwindcss.com',
  'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600&display=swap',
  'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js',
];

// Ambience sounds to cache when used
const AMBIENCE_URLS = [
  'https://cdn.freesound.org/previews/531/531947_2931078-lq.mp3',
  'https://cdn.freesound.org/previews/456/456389_9159316-lq.mp3',
  'https://cdn.freesound.org/previews/378/378178_6393979-lq.mp3',
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => {
      console.log('[SW] Caching static assets');
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys
          .filter((key) => key !== STATIC_CACHE && key !== DYNAMIC_CACHE)
          .map((key) => {
            console.log('[SW] Removing old cache:', key);
            return caches.delete(key);
          })
      );
    })
  );
  self.clients.claim();
});

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') return;

  // Skip chrome-extension and other non-http(s) requests
  if (!url.protocol.startsWith('http')) return;

  // For API calls (like Google GenAI), always go to network
  if (url.hostname.includes('generativelanguage.googleapis.com') || 
      url.hostname.includes('esm.sh')) {
    event.respondWith(
      fetch(request).catch(() => {
        return new Response(JSON.stringify({ error: 'Offline' }), {
          headers: { 'Content-Type': 'application/json' }
        });
      })
    );
    return;
  }

  // Network-first strategy for HTML pages
  if (request.headers.get('accept')?.includes('text/html')) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const clonedResponse = response.clone();
          caches.open(DYNAMIC_CACHE).then((cache) => {
            cache.put(request, clonedResponse);
          });
          return response;
        })
        .catch(() => {
          return caches.match(request).then((cachedResponse) => {
            return cachedResponse || caches.match('/');
          });
        })
    );
    return;
  }

  // Network-first for JS/TS modules to ensure fresh code
  if (url.pathname.endsWith('.js') || url.pathname.endsWith('.ts') || 
      url.pathname.endsWith('.tsx') || url.pathname.endsWith('.jsx') ||
      url.pathname.includes('/assets/') || url.pathname.includes('/@')) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const clonedResponse = response.clone();
          caches.open(DYNAMIC_CACHE).then((cache) => {
            cache.put(request, clonedResponse);
          });
          return response;
        })
        .catch(() => {
          return caches.match(request);
        })
    );
    return;
  }

  // Cache-first for audio files (ambience sounds)
  if (request.destination === 'audio' || url.pathname.endsWith('.mp3') || url.pathname.endsWith('.ogg') ||
      AMBIENCE_URLS.some(ambUrl => request.url.includes(ambUrl))) {
    event.respondWith(
      caches.match(request).then((cachedResponse) => {
        if (cachedResponse) {
          console.log('[SW] Serving cached audio:', url.pathname);
          return cachedResponse;
        }
        return fetch(request)
          .then((response) => {
            if (response && response.status === 200) {
              const clonedResponse = response.clone();
              caches.open(DYNAMIC_CACHE).then((cache) => {
                console.log('[SW] Caching audio for offline:', request.url);
                cache.put(request, clonedResponse);
              });
            }
            return response;
          })
          .catch(() => {
            console.log('[SW] Audio unavailable offline:', request.url);
            return new Response(null, { status: 404 });
          });
      })
    );
    return;
  }

  // Cache-first strategy for static assets
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }

      return fetch(request)
        .then((response) => {
          // Don't cache if not a valid response
          if (!response || response.status !== 200 || response.type !== 'basic') {
            // Still cache external resources
            if (EXTERNAL_ASSETS.some(asset => request.url.includes(asset))) {
              const clonedResponse = response.clone();
              caches.open(DYNAMIC_CACHE).then((cache) => {
                cache.put(request, clonedResponse);
              });
            }
            return response;
          }

          const clonedResponse = response.clone();
          caches.open(DYNAMIC_CACHE).then((cache) => {
            cache.put(request, clonedResponse);
          });

          return response;
        })
        .catch(() => {
          // Return offline fallback for images
          if (request.destination === 'image') {
            return new Response(
              '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect fill="#161B22" width="100" height="100"/><text fill="#64FFDA" x="50%" y="50%" text-anchor="middle" dy=".3em">Offline</text></svg>',
              { headers: { 'Content-Type': 'image/svg+xml' } }
            );
          }
        });
    })
  );
});

// Handle background sync for offline task creation
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-tasks') {
    event.waitUntil(syncTasks());
  }
});

async function syncTasks() {
  // This would sync any offline changes when back online
  console.log('[SW] Syncing tasks...');
}

// Handle push notifications from server
self.addEventListener('push', (event) => {
  console.log('[SW] Push notification received');
  
  let data = {
    title: 'ZEN Study',
    body: 'Time for a study break!',
    icon: '/icons/icon-192x192.svg',
    badge: '/icons/icon-72x72.svg',
    url: '/'
  };

  // Try to parse JSON data from the push event
  if (event.data) {
    try {
      const payload = event.data.json();
      data = { ...data, ...payload };
    } catch (e) {
      // If not JSON, use text as body
      data.body = event.data.text() || data.body;
    }
  }

  const options = {
    body: data.body,
    icon: data.icon,
    badge: data.badge,
    vibrate: [200, 100, 200, 100, 200], // Stronger vibration pattern
    data: {
      url: data.url,
      dateOfArrival: Date.now(),
      ...data.data
    },
    actions: [
      { action: 'open', title: 'Open' },
      { action: 'dismiss', title: 'Dismiss' }
    ],
    requireInteraction: false,
    tag: data.tag || 'zen-notification',
    renotify: true,
    silent: false // Allow system to play default sound
  };

  event.waitUntil(
    Promise.all([
      self.registration.showNotification(data.title, options),
      // Play custom notification sound
      playNotificationSound()
    ])
  );
});

// Play notification sound
async function playNotificationSound() {
  try {
    // Get all clients (open windows/tabs)
    const allClients = await clients.matchAll({ includeUncontrolled: true });
    
    // Send message to any open client to play sound
    for (const client of allClients) {
      client.postMessage({ type: 'PLAY_NOTIFICATION_SOUND' });
    }
  } catch (e) {
    console.log('[SW] Could not play notification sound:', e);
  }
}
});

// Handle notification clicks
self.addEventListener('notificationclick', (event) => {
  console.log('[SW] Notification clicked:', event.action);
  event.notification.close();

  const urlToOpen = event.notification.data?.url || '/';

  if (event.action === 'dismiss') {
    return; // Just close the notification
  }

  // Open or focus the app
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((windowClients) => {
        // Check if app is already open
        for (const client of windowClients) {
          if (client.url.includes(self.location.origin) && 'focus' in client) {
            client.navigate(urlToOpen);
            return client.focus();
          }
        }
        // If not open, open a new window
        return clients.openWindow(urlToOpen);
      })
  );
});

// Handle notification close (for analytics if needed)
self.addEventListener('notificationclose', (event) => {
  console.log('[SW] Notification closed');
});
