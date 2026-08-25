const CACHE_VERSION = 12;
const STATIC_CACHE = `zen-static-v${CACHE_VERSION}`;
const DYNAMIC_CACHE = `zen-dynamic-v${CACHE_VERSION}`;
const OLDEST_RETAINED_CACHE_VERSION = CACHE_VERSION - 1;
const CHUNK_RECOVERY_QUERY = 'az-chunk-recovery';

console.log(`[SW] Service Worker v${CACHE_VERSION} loaded`);

// Assets to cache immediately on install
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icons/icon.svg',
  '/icons/icon-192x192.svg',
  '/icons/icon-512x512.svg',
  '/sounds/phone-alert-marimba-bubble-om-fx-1-00-01.mp3',
  '/sounds/rain-ambience-gentle-downpour-vincentmets-1-01-50.mp3',
  '/sounds/forest-ambience-light-birdsong-distant-rooster-vincentmets-1-03-38.mp3',
];

// External resources to cache (will be cached on first use)
const EXTERNAL_ASSETS = [
  'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600&display=swap',
  'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js',
  'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js',
];

// Local ambience sounds (already in STATIC_ASSETS)
const AMBIENCE_URLS = [];

async function cacheApplicationChunks(cache) {
  try {
    const response = await fetch('/.vite/manifest.json', { cache: 'no-store' });
    if (!response.ok) return;
    const manifest = await response.json();
    const assetUrls = new Set();
    const visited = new Set();

    const addEntry = (key) => {
      if (!key || visited.has(key) || !manifest[key]) return;
      visited.add(key);
      const entry = manifest[key];
      if (entry.file) assetUrls.add(`/${entry.file}`);
      for (const css of entry.css || []) assetUrls.add(`/${css}`);
      for (const asset of entry.assets || []) assetUrls.add(`/${asset}`);
      for (const imported of entry.imports || []) addEntry(imported);
    };

    for (const key of Object.keys(manifest)) addEntry(key);

    const results = await Promise.allSettled([...assetUrls].map((url) => cache.add(url)));
    const failedCount = results.filter((result) => result.status === 'rejected').length;
    if (failedCount > 0) {
      console.warn(`[SW] ${failedCount} application assets could not be precached`);
    }
  } catch (error) {
    console.warn('[SW] Application chunk precache skipped:', error?.message || error);
  }
}

// Install event - cache static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then(async (cache) => {
      console.log('[SW] Caching static assets');
      await cache.addAll(STATIC_ASSETS);
      await cacheApplicationChunks(cache);
    })
  );
  self.skipWaiting();
});

const appCacheVersion = (key) => {
  const match = /^zen-(?:static|dynamic)-v(\d+)$/.exec(key);
  return match ? Number(match[1]) : null;
};

// Keep one complete previous release so tabs that were already open can still
// request its content-hashed chunks while the latest service worker activates.
self.addEventListener('activate', (event) => {
  console.log(`[SW] Activating service worker v${CACHE_VERSION}`);
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys
          .filter((key) => {
            const version = appCacheVersion(key);
            return version !== null && version < OLDEST_RETAINED_CACHE_VERSION;
          })
          .map((key) => {
            console.log('[SW] Removing old cache:', key);
            return caches.delete(key);
          })
      );
    }).then(() => {
      console.log(`[SW] Service worker v${CACHE_VERSION} activated and claiming clients`);
      return self.clients.claim();
    })
  );
});

async function matchAppCaches(request) {
  const currentStatic = await caches.match(request, { cacheName: STATIC_CACHE });
  if (currentStatic) return currentStatic;

  const currentDynamic = await caches.match(request, { cacheName: DYNAMIC_CACHE });
  if (currentDynamic) return currentDynamic;

  // A prior release may still be serving an already-open tab.
  return caches.match(request);
}

async function refreshClientAfterMissingChunk(clientId) {
  if (!clientId) return;

  const client = await self.clients.get(clientId);
  if (!client || !('navigate' in client)) return;

  const clientUrl = new URL(client.url);
  if (clientUrl.searchParams.has(CHUNK_RECOVERY_QUERY)) return;

  clientUrl.searchParams.set(CHUNK_RECOVERY_QUERY, String(Date.now()));
  console.warn('[SW] Retired application chunk requested; refreshing client');
  await client.navigate(clientUrl.toString());
}

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') return;

  // Skip chrome-extension and other non-http(s) requests
  if (!url.protocol.startsWith('http')) return;

  // Skip API calls to our backend and external services - let them go directly to network
  if (url.hostname.includes('academiazen-backend') || 
      url.hostname.includes('render.com') ||
      url.hostname.includes('openrouter.ai') ||
      url.hostname.includes('generativelanguage.googleapis.com') || 
      url.hostname.includes('esm.sh') ||
      url.pathname.includes('/api/')) {
    // Don't intercept - let browser handle directly
    return;
  }

  // Network-first strategy for HTML pages
  if (request.headers.get('accept')?.includes('text/html')) {
    event.respondWith(
      fetch(request)
        .then(async (response) => {
          const clonedResponse = response.clone();
          const cache = await caches.open(DYNAMIC_CACHE);
          await cache.put(request, clonedResponse);
          return response;
        })
        .catch(() => {
          return matchAppCaches(request).then(async (cachedResponse) => {
            if (cachedResponse) return cachedResponse;
            return caches.match('/', { cacheName: STATIC_CACHE });
          });
        })
    );
    return;
  }

  // Production assets are content-hashed and immutable. Cache-first makes an
  // already installed release deterministic offline while new hashes still
  // fall through to the network after a deployment.
  if (url.origin === self.location.origin && url.pathname.includes('/assets/')) {
    event.respondWith(
      matchAppCaches(request).then(async (cachedResponse) => {
        if (cachedResponse) return cachedResponse;
        const response = await fetch(request);
        if (response?.ok) {
          const cache = await caches.open(DYNAMIC_CACHE);
          await cache.put(request, response.clone());
        } else if (
          (response?.status === 404 || response?.status === 410) &&
          (request.destination === 'script' || url.pathname.endsWith('.js'))
        ) {
          await refreshClientAfterMissingChunk(event.clientId);
        }
        return response;
      })
    );
    return;
  }

  // Network-first for development JS/TS modules to ensure fresh code
  if (url.pathname.endsWith('.js') || url.pathname.endsWith('.ts') || 
      url.pathname.endsWith('.tsx') || url.pathname.endsWith('.jsx') ||
      url.pathname.includes('/@')) {
    event.respondWith(
      fetch(request)
        .then(async (response) => {
          const clonedResponse = response.clone();
          const cache = await caches.open(DYNAMIC_CACHE);
          await cache.put(request, clonedResponse);
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
        .then(async (response) => {
          // Don't cache if not a valid response
          if (!response || response.status !== 200 || response.type !== 'basic') {
            // Still cache external resources
            if (EXTERNAL_ASSETS.some(asset => request.url.includes(asset))) {
              const clonedResponse = response.clone();
              const cache = await caches.open(DYNAMIC_CACHE);
              await cache.put(request, clonedResponse);
            }
            return response;
          }

          const clonedResponse = response.clone();
          const cache = await caches.open(DYNAMIC_CACHE);
          await cache.put(request, clonedResponse);

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
    // Windows compatibility settings
    requireInteraction: true, // Keep notification visible until user interacts (important for Windows)
    tag: data.tag || 'zen-notification',
    renotify: true, // Show notification even if same tag exists
    silent: false, // Allow system to play default sound
    // Timestamp helps Windows display notifications properly
    timestamp: Date.now()
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
