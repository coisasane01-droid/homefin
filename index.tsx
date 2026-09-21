import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';

const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
}

if ('serviceWorker' in navigator) {
  window.addEventListener('load', async () => {
    try {
      const registration = await navigator.serviceWorker.register('/sw.js');

      console.log('HomeFin Service Worker registrado:', registration.scope);

      await registration.update();

      if (registration.waiting) {
        registration.waiting.postMessage('SKIP_WAITING');
      }

      navigator.serviceWorker.addEventListener('controllerchange', () => {
        window.location.reload();
      });
    } catch (error) {
      console.error('Erro ao registrar/atualizar Service Worker:', error);
    }
  });
}
