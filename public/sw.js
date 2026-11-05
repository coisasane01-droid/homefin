const CACHE_NAME = 'homefin-v1';

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('push', (event) => {
  let data;

  try {
    data = event.data ? event.data.json() : {};
  } catch {
    const body = event.data ? event.data.text() : '';
    data = { title: 'HomeFin', body };
  }

  const title = String(data.title || 'HomeFin').slice(0, 100);
  let url = new URL('/', self.location.origin);
  try {
    const candidate = new URL(data.url || '/', self.location.origin);
    if (candidate.origin === self.location.origin) url = candidate;
  } catch {
    // Keep the notification link within the HomeFin origin.
  }

  const options = {
    body: String(data.body || '').slice(0, 500),
    icon: '/pwa-192x192.png',
    badge: '/pwa-192x192.png',
    data: {
      url: url.href,
    },
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  event.waitUntil(
    (async () => {
      let target = new URL('/', self.location.origin);
      try {
        const candidate = new URL(event.notification?.data?.url || '/', self.location.origin);
        if (candidate.origin === self.location.origin) target = candidate;
      } catch {
        // Keep the notification link within the HomeFin origin.
      }

      const windows = await self.clients.matchAll({
        type: 'window',
        includeUncontrolled: true,
      });
      for (const client of windows) {
        const clientUrl = new URL(client.url);
        if (
          clientUrl.origin !== self.location.origin ||
          clientUrl.pathname === '/admin' ||
          clientUrl.pathname.startsWith('/admin/')
        ) continue;
        if (client.url !== target.href && 'navigate' in client) {
          await client.navigate(target.href);
        }
        return client.focus();
      }

      return self.clients.openWindow(target.href);
    })()
  );
});
