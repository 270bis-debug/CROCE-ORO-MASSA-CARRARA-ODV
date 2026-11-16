// Service Worker per Croce Oro Massa Carrara
// Gestisce:
// 1. Auto-aggiornamento immediato PWA (Google Play Console / Android TWA & Apple iOS Home Screen WebClip)
// 2. Strategia Network-First su navigazione per caricare SEMPRE l'ultima release pubblicata
// 3. Notifiche Push in Background ad Alta Priorità e Risveglio Schermo Bloccato

const CACHE_NAME = 'croce-oro-cache-v4.3.9';

const PRECACHE_ASSETS = [
  '/',
  '/manifest.json',
  '/favicon.png',
  '/apple-touch-icon.png',
  '/icon-192-v2.png',
  '/icon-512-v2.png',
  '/icon-maskable-192.png',
  '/icon-maskable-512.png',
  '/logo_croce_oro_v2.png',
  '/annuncio_emergenza.wav'
];

// Installazione: scarica gli asset minimi e forza l'attivazione immediata (skipWaiting)
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_ASSETS).catch((err) => {
        console.warn('[SW] Precache parziale asset completata con avviso:', err);
      });
    }).then(() => self.skipWaiting())
  );
});

// Attivazione: elimina le vecchie cache obsolete e qualsiasi file sorgente/dev eventualmente memorizzato
// PRESERVA tassativamente: localStorage, indexedDB, dati missioni, impostazioni e credenziali
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys
          .filter((key) => key.startsWith('croce-oro-cache-') && key !== CACHE_NAME)
          .map((key) => {
            console.log(`[SW] Rimozione vecchia cache Croce Oro: ${key}`);
            return caches.delete(key);
          })
      );
    }).then(async () => {
      try {
        const currentCache = await caches.open(CACHE_NAME);
        const cachedReqs = await currentCache.keys();
        await Promise.all(
          cachedReqs
            .filter((r) => {
              const p = new URL(r.url).pathname;
              return (
                p.startsWith('/src/') ||
                p.startsWith('/@') ||
                p.startsWith('/node_modules/') ||
                p.endsWith('.ts') ||
                p.endsWith('.tsx') ||
                p.endsWith('.jsx')
              );
            })
            .map((r) => currentCache.delete(r))
        );
      } catch {}
    }).then(() => {
      return self.clients.claim();
    }).then(() => {
      // Invia un broadcast a tutte le finestre aperte per notificare l'aggiornamento
      return self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    }).then((clients) => {
      clients.forEach((client) => {
        client.postMessage({
          type: 'SW_VERSION_ACTIVATED',
          version: CACHE_NAME,
          timestamp: Date.now()
        });
      });
    })
  );
});

// Messaggi tra Client e Service Worker
self.addEventListener('message', (event) => {
  if (!event.data) return;

  if (event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  } else if (event.data.type === 'CHECK_VERSION') {
    event.source?.postMessage({
      type: 'VERSION_INFO',
      version: CACHE_NAME
    });
  }
});

// Gestione Richieste HTTP (Fetch)
self.addEventListener('fetch', (event) => {
  const req = event.request;

  // Intercetta solo richieste GET
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // Non intercettare schemi speciali (chrome-extension, blob, etc.)
  if (!url.protocol.startsWith('http')) return;

  // 1. Bypass totale per chiamate API, version endpoint, WebSocket, SSE, moduli sorgente Vite dev e domini esterni
  if (
    url.pathname.startsWith('/api/') ||
    url.pathname === '/version.json' ||
    url.pathname === '/sw.js' ||
    url.pathname.startsWith('/socket.io/') ||
    url.pathname.includes('/sse') ||
    url.pathname.includes('/realtime') ||
    url.pathname.startsWith('/src/') ||
    url.pathname.startsWith('/@') ||
    url.pathname.startsWith('/node_modules/') ||
    url.pathname.endsWith('.ts') ||
    url.pathname.endsWith('.tsx') ||
    url.pathname.endsWith('.jsx') ||
    url.pathname.endsWith('.map') ||
    url.search.includes('t=') ||
    url.hostname !== self.location.hostname
  ) {
    return; // Passa direttamente alla rete senza cache
  }

  // 2. Richieste di navigazione HTML: Network-First con fallback a cache
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req, { cache: 'no-cache' })
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(req, responseClone);
            });
          }
          return networkResponse;
        })
        .catch(async () => {
          console.log('[SW] Dispositivo offline, caricamento shell da cache');
          const cachedResponse = await caches.match(req);
          if (cachedResponse) return cachedResponse;
          const rootFallback = await caches.match('/');
          if (rootFallback) return rootFallback;
          return new Response('Croce Oro Massa Carrara - Modalità Offline', {
            status: 503,
            headers: { 'Content-Type': 'text/plain; charset=utf-8' }
          });
        })
    );
    return;
  }

  // 3. Asset statici di build con hash univoco (/assets/*): Stale-While-Revalidate
  if (url.pathname.startsWith('/assets/')) {
    event.respondWith(
      caches.match(req).then((cachedResponse) => {
        const fetchPromise = fetch(req).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(req, responseClone);
            });
          }
          return networkResponse;
        }).catch(() => cachedResponse);

        return cachedResponse || fetchPromise;
      })
    );
    return;
  }

  // 4. Solo file multimediali, icone e font statici: Cache-First con fallback a rete
  if (/\.(png|jpg|jpeg|gif|svg|ico|webp|woff2?|ttf|mp3|wav)$/i.test(url.pathname)) {
    event.respondWith(
      caches.match(req).then((cachedResponse) => {
        if (cachedResponse) return cachedResponse;

        return fetch(req).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(req, responseClone);
            });
          }
          return networkResponse;
        });
      })
    );
  }
});

// ============================================================================
// GESTIONE NOTIFICHE PUSH AD ALTA PRIORITÀ E RISVEGLIO SCHERMO BLOCCATO
// ============================================================================

self.addEventListener('push', (event) => {
  let data = {
    title: '🚨 ALLERTA SOCCORSO - CROCE ORO',
    body: 'Nuova missione o allarme ricevuto dalla Centrale Operativa.',
    tag: 'croce-oro-emergency',
    urgenza: 'ROSSO',
    source: 'Centrale Operativa',
    soundType: 'telefono',
    codice: '',
    timestamp: Date.now()
  };

  try {
    if (event.data) {
      const parsed = event.data.json();
      data = { ...data, ...parsed };
    }
  } catch (err) {
    if (event.data) {
      data.body = event.data.text();
    }
  }

  // Schema di vibrazione potente di soccorso
  const vibrationPattern = data.urgenza === 'ROSSO'
    ? [1000, 300, 1000, 300, 1500, 400, 1500, 400, 2000]
    : [600, 200, 600, 200, 1000, 300, 1000];

  const options = {
    body: data.body,
    icon: '/icon-192-v2.png',
    badge: '/icon-192-v2.png',
    image: data.image || undefined,
    vibrate: vibrationPattern,
    tag: (data.tag || 'dispatch') + '-' + Date.now(),
    renotify: true,
    requireInteraction: true,
    silent: false,
    data: {
      url: `/?ring=1&soundType=${data.soundType || 'telefono'}&source=${encodeURIComponent(data.source || 'Centrale')}&codice=${data.codice || ''}`,
      timestamp: Date.now(),
      ...data
    },
    actions: [
      { action: 'open_mission', title: '🚨 APRI SCHEDA E SQUILLO' },
      { action: 'silence_alarm', title: '🔕 Silenzia' }
    ]
  };

  const notifyClients = self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
    clients.forEach((client) => {
      client.postMessage({
        type: 'REMOTE_PUSH_RECEIVED',
        data: data
      });
    });
  });

  event.waitUntil(
    Promise.all([
      notifyClients,
      self.registration.showNotification(data.title, options)
    ])
  );
});

// Click sulla notifica da blocco schermo o tendina notifiche
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'silence_alarm') {
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      clients.forEach((client) => {
        client.postMessage({ type: 'STOP_RING' });
      });
    });
    return;
  }

  const targetUrl = (event.notification.data && event.notification.data.url) || '/?ring=1';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url && 'focus' in client) {
          client.postMessage({
            type: 'FOCUS_WITH_RING',
            data: event.notification.data
          });
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});
