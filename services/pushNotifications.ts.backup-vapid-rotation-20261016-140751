const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY;

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0)));
}

export type PushUserType = 'family' | 'admin';

export async function subscribeToPush(
  familyId: string,
  userType: PushUserType
) {
  if (!('serviceWorker' in navigator)) {
    throw new Error('Service Worker não disponível neste navegador.');
  }

  if (!('PushManager' in window)) {
    throw new Error('Push Notifications não disponíveis neste navegador.');
  }

  if (!VAPID_PUBLIC_KEY) {
    throw new Error('VITE_VAPID_PUBLIC_KEY não configurada.');
  }

  const permission = await Notification.requestPermission();

  if (permission !== 'granted') {
    throw new Error('Permissão para notificações não foi concedida.');
  }

  const registration = await navigator.serviceWorker.ready;

  let subscription = await registration.pushManager.getSubscription();

  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    });
  }

  const response = await fetch('/api/push-subscribe', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      familyId,
      userType,
      subscription: subscription.toJSON(),
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      data?.error || 'Não foi possível registrar as notificações Push.'
    );
  }

  return subscription;
}

export async function unsubscribeFromPush() {
  if (!('serviceWorker' in navigator)) return;

  const registration = await navigator.serviceWorker.ready;
  const subscription =
    await registration.pushManager.getSubscription();

  if (!subscription) return;

  const endpoint = subscription.endpoint;

  try {
    await fetch(
      `/api/push-subscribe?endpoint=${encodeURIComponent(endpoint)}`,
      {
        method: 'DELETE',
      }
    );
  } finally {
    await subscription.unsubscribe();
  }
}
