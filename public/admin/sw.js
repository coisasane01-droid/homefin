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
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: 'HomeFin Admin', body: event.data ? event.data.text() : '' };
  }

  let url = new URL('/admin/#/admin/panel', self.location.origin);
  try {
    const candidate = new URL(data.url || url.href, self.location.origin);
    if (candidate.origin === self.location.origin) url = candidate;
  } catch {
    // Keep the notification link within the HomeFin origin.
  }

  event.waitUntil(self.registration.showNotification(
    String(data.title || 'HomeFin Admin').slice(0, 100),
    {
      body: String(data.body || '').slice(0, 500),
      icon: '/homefin-admin-icon-192.png',
      badge: '/homefin-admin-icon-192.png',
      data: { url: url.href },
    }
  ));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil((async () => {
    let target = new URL('/admin/#/admin/panel', self.location.origin);
    try {
      const candidate = new URL(event.notification?.data?.url || target.href, self.location.origin);
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
        (clientUrl.pathname !== '/admin' && !clientUrl.pathname.startsWith('/admin/'))
      ) continue;
      if (client.url !== target.href && 'navigate' in client) {
        await client.navigate(target.href);
      }
      return client.focus();
    }
    return self.clients.openWindow(target.href);
  })());
});
