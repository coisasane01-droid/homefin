import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';

type HomeFinInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
};

type HomeFinWindow = Window & {
  __homefinInstallPrompt?: HomeFinInstallPromptEvent | null;
  __homefinAppInstalled?: boolean;
};

// Captura a instalação do PWA desde o início do aplicativo.
window.addEventListener('beforeinstallprompt', (event: Event) => {
  const appWindow = window as HomeFinWindow;
  const isStandalone =
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true;
  if (isStandalone) return;

  event.preventDefault();
  appWindow.__homefinInstallPrompt = event as HomeFinInstallPromptEvent;
  window.dispatchEvent(new Event('homefin-install-available'));
});

window.addEventListener('appinstalled', () => {
  const appWindow = window as HomeFinWindow;
  appWindow.__homefinInstallPrompt = null;
  appWindow.__homefinAppInstalled = true;
  window.dispatchEvent(new Event('homefin-app-installed'));
});

const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
}

function updateAdminFavicon() {
  try {
    const hashPath = window.location.hash.split('?')[0];
    const isAdmin = hashPath.startsWith('#/admin');

    let favicon = document.getElementById('app-favicon') as HTMLLinkElement | null;

    if (!favicon) {
      favicon = document.createElement('link');
      favicon.id = 'app-favicon';
      favicon.rel = 'icon';
      favicon.type = 'image/png';
      document.head.appendChild(favicon);
    }

    favicon.href = isAdmin
      ? '/homefin-admin-icon-192.png?v=2'
      : '/homefin-icon-192.png';
  } catch {}
}

updateAdminFavicon();
window.addEventListener('hashchange', updateAdminFavicon);

if ('serviceWorker' in navigator) {
  window.addEventListener('load', async () => {
    let refreshing = false;

    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (refreshing) return;
      refreshing = true;
      window.location.reload();
    });

    try {
      const isAdminApp =
        window.location.pathname === '/admin/' ||
        window.location.pathname === '/admin';
      const scriptUrl = isAdminApp ? '/admin/sw.js' : '/sw.js';
      const scope = isAdminApp ? '/admin/' : '/';
      const registration = await navigator.serviceWorker.register(scriptUrl, {
        scope,
        updateViaCache: 'none',
      });

      console.log('HomeFin Service Worker registrado:', registration.scope);

      const activateUpdate = (worker: ServiceWorker | null) => {
        if (worker && navigator.serviceWorker.controller) {
          worker.postMessage('SKIP_WAITING');
        }
      };

      if (registration.waiting) {
        activateUpdate(registration.waiting);
      }

      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing;

        if (!newWorker) return;

        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed') {
            activateUpdate(newWorker);
          }
        });
      });

      await registration.update();
    } catch (error) {
      console.error('Erro ao registrar/atualizar Service Worker:', error);
    }
  });
}
