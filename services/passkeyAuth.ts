import { homefinApiUrl } from './nativeApi';
import { startAuthentication, startRegistration } from '@simplewebauthn/browser';
import { getFamilySessionToken, storeFamilySession, type FamilyAuthResponse } from './familyAuth';

type PasskeyResponse = FamilyAuthResponse & { options?: any };

async function passkeyRequest(familyId: string, action: string, response?: unknown, authenticated = false, pin?: string): Promise<PasskeyResponse> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (authenticated) {
    const token = await getFamilySessionToken(familyId);
    if (!token) throw new Error('Entre com seu PIN antes de cadastrar a biometria.');
    headers.Authorization = `Bearer ${token}`;
  }
  const result = await fetch(homefinApiUrl('/api/passkey'), {
    method: 'POST', headers, cache: 'no-store',
    body: JSON.stringify({ familyId, action, ...(response ? { response } : {}), ...(pin ? { pin } : {}) }),
  });
  const data = await result.json() as PasskeyResponse;
  if (!result.ok) throw new Error(data.error || 'Falha na biometria.');
  return data;
}

export function passkeyAvailable(): boolean {
  return window.isSecureContext && typeof window.PublicKeyCredential !== 'undefined';
}

export async function registerFamilyPasskey(familyId: string, pin: string): Promise<void> {
  if (!passkeyAvailable()) throw new Error('Biometria indisponível neste aparelho ou navegador.');
  const initial = await passkeyRequest(familyId, 'register-options', undefined, true, pin);
  if (!initial.options) throw new Error('Servidor não retornou opções de cadastro.');
  const response = await startRegistration({ optionsJSON: initial.options });
  await passkeyRequest(familyId, 'register-verify', response, true);
  localStorage.setItem(`homefin_passkey_enabled_${familyId}`, '1');
}

export async function loginFamilyPasskey(familyId: string): Promise<void> {
  if (!passkeyAvailable()) throw new Error('Biometria indisponível neste aparelho ou navegador.');
  const initial = await passkeyRequest(familyId, 'authenticate-options');
  if (!initial.options) throw new Error('Servidor não retornou opções de autenticação.');
  const response = await startAuthentication({ optionsJSON: initial.options });
  const session = await passkeyRequest(familyId, 'authenticate-verify', response);
  await storeFamilySession(familyId, session);
  localStorage.setItem(`homefin_passkey_enabled_${familyId}`, '1');
}
