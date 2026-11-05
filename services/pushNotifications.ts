const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY;

export type PushUserType = 'family' | 'admin';

interface PushResponse {
  success: boolean;
  sent: number;
  failed: number;
  subscriptions: number;
  message?: string;
  error?: string;
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map((character) => character.charCodeAt(0)));
}

function getSessionToken(
  familyId: string,
  userType: PushUserType,
  suppliedToken?: string
): string {
  if (userType === 'admin') {
    if (!suppliedToken) throw new Error('Sessão administrativa indisponível.');
    return suppliedToken;
  }

  const token = localStorage.getItem(`homefin_family_session_token_${familyId}`);
  const expiresAt = Number(
    localStorage.getItem(`homefin_family_session_expires_at_${familyId}`) || 0
  );
  if (!token || !expiresAt || expiresAt <= Date.now()) {
    throw new Error('Sua sessão familiar expirou. Entre novamente para gerenciar notificações.');
  }
  return token;
}

function registrationScope(userType: PushUserType): string {
  return userType === 'admin' ? '/admin/' : '/';
}

async function getPushRegistration(userType: PushUserType): Promise<ServiceWorkerRegistration> {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    throw new Error('Notificações Push não são compatíveis com este navegador.');
  }

  const registration = await navigator.serviceWorker.getRegistration(registrationScope(userType));
  if (!registration?.active) {
    throw new Error('O Service Worker do HomeFin ainda não está ativo. Recarregue o aplicativo e tente novamente.');
  }
  return registration;
}

async function authorizedFetch(
  familyId: string,
  userType: PushUserType,
  token: string,
  method: 'POST' | 'DELETE',
  body: Record<string, unknown>
): Promise<{ success: boolean; removed?: boolean }> {
  const response = await fetch('/api/push-subscribe', {
    method,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    cache: 'no-store',
    body: JSON.stringify({ familyId, userType, ...body }),
  });
  const result = await response.json().catch(() => null);

  if (!response.ok || result?.success !== true) {
    throw new Error(result?.error || `Falha ao atualizar inscrição Push (HTTP ${response.status}).`);
  }
  return result;
}

export async function subscribeToPush(
  familyId: string,
  userType: PushUserType,
  adminToken?: string
): Promise<PushSubscription> {
  if (!familyId || (userType === 'family' && familyId === 'v1')) {
    throw new Error('Identificação familiar inválida para notificações.');
  }
  if (!('Notification' in window)) {
    throw new Error('Notificações não são compatíveis com este navegador.');
  }
  if (!VAPID_PUBLIC_KEY) {
    throw new Error('VITE_VAPID_PUBLIC_KEY não está configurada no build do aplicativo.');
  }

  const token = getSessionToken(familyId, userType, adminToken);
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    throw new Error('Permissão para notificações não foi concedida.');
  }

  const registration = await getPushRegistration(userType);
  let expectedKey: Uint8Array;
  try {
    expectedKey = urlBase64ToUint8Array(VAPID_PUBLIC_KEY);
  } catch {
    throw new Error('VITE_VAPID_PUBLIC_KEY possui formato inválido.');
  }
  if (expectedKey.length !== 65 || expectedKey[0] !== 4) {
    throw new Error('VITE_VAPID_PUBLIC_KEY não é uma chave pública VAPID válida.');
  }

  const markerKey = `homefin_vapid_subscription_${VAPID_PUBLIC_KEY}`;
  let subscription = await registration.pushManager.getSubscription();
  let createdSubscription = false;

  if (subscription) {
    const existingKey = subscription.options?.applicationServerKey;
    const keyMatches = existingKey
      ? (() => {
          const currentKey = new Uint8Array(existingKey);
          return currentKey.length === expectedKey.length &&
            currentKey.every((value, index) => value === expectedKey[index]);
        })()
      : localStorage.getItem(markerKey) === 'confirmed';

    if (!keyMatches) {
      await authorizedFetch(familyId, userType, token, 'DELETE', {
        endpoint: subscription.endpoint,
      });
      await subscription.unsubscribe();
      subscription = null;
    }
  }

  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: expectedKey,
    });
    createdSubscription = true;
  }

  try {
    await authorizedFetch(familyId, userType, token, 'POST', {
      subscription: subscription.toJSON(),
    });
    localStorage.setItem(markerKey, 'confirmed');
    return subscription;
  } catch (error) {
    if (createdSubscription) {
      try {
        await subscription.unsubscribe();
      } catch (cleanupError) {
        console.error('Não foi possível limpar a inscrição Push não registrada:', cleanupError);
      }
    }
    throw error;
  }
}

export async function unsubscribeFromPush(
  familyId: string,
  userType: PushUserType,
  adminToken?: string
): Promise<void> {
  if (!familyId || (userType === 'family' && familyId === 'v1')) {
    throw new Error('Identificação familiar inválida para notificações.');
  }

  const token = getSessionToken(familyId, userType, adminToken);
  const registration = await getPushRegistration(userType);
  const subscription = await registration.pushManager.getSubscription();
  if (!subscription) return;

  await authorizedFetch(familyId, userType, token, 'DELETE', {
    endpoint: subscription.endpoint,
  });
  const unsubscribed = await subscription.unsubscribe();
  if (!unsubscribed) {
    throw new Error('O navegador não confirmou o cancelamento da inscrição Push.');
  }
}

export async function sendFamilyPushNotification(
  familyId: string,
  title: string,
  body: string,
  url = `/#/login?family=${encodeURIComponent(familyId)}`
): Promise<PushResponse> {
  const token = getSessionToken(familyId, 'family');
  const response = await fetch('/api/push', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    cache: 'no-store',
    body: JSON.stringify({ familyId, userType: 'family', title, body, url }),
  });
  const result = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(result?.error || `Falha ao enviar Push (HTTP ${response.status}).`);
  }
  if (result?.success !== true) {
    throw new Error(result?.message || 'Nenhuma notificação Push foi confirmada como enviada.');
  }
  return result as PushResponse;
}
