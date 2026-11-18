import { homefinApiUrl } from './nativeApi';
import {
  secureSessionGet,
  secureSessionSet,
  secureSessionRemove,
  isNativeHomeFin,
} from './secureSession';

export interface FamilyAuthResponse {
  success?: boolean;
  token?: string;
  expiresIn?: number;
  error?: string;
  enrolled?: boolean;
  hasRecovery?: boolean;
  valid?: boolean;
}

export function getFamilyTokenKey(familyId: string): string {
  return `homefin_family_session_token_${familyId}`;
}

export function getFamilyExpiryKey(familyId: string): string {
  return `homefin_family_session_expires_at_${familyId}`;
}

async function readSecureValue(key: string): Promise<string | null> {
  const secureValue = await secureSessionGet(key);

  if (secureValue) return secureValue;

  // Migração de sessões antigas para o armazenamento protegido.
  if (isNativeHomeFin()) {
    const legacyValue = localStorage.getItem(key);

    if (legacyValue) {
      await secureSessionSet(key, legacyValue);
      localStorage.removeItem(key);
      return legacyValue;
    }
  }

  return null;
}

export async function getFamilySessionToken(
  familyId: string
): Promise<string | null> {
  if (!familyId || familyId === 'v1') return null;

  const token = await readSecureValue(getFamilyTokenKey(familyId));
  const expiry = await readSecureValue(getFamilyExpiryKey(familyId));

  if (!token || !expiry || Number(expiry) <= Date.now()) {
    if (token || expiry) await clearFamilySession(familyId);
    return null;
  }

  return token;
}

export async function storeFamilySession(
  familyId: string,
  result: FamilyAuthResponse
): Promise<void> {
  if (!familyId || familyId === 'v1') {
    throw new Error('Identificação familiar inválida.');
  }

  const expiresIn = Number(result.expiresIn);

  if (
    !result.token ||
    !Number.isFinite(expiresIn) ||
    expiresIn <= 0
  ) {
    throw new Error(
      'O servidor não confirmou a criação da sessão familiar.'
    );
  }

  const expiry = String(Date.now() + expiresIn * 1000);

  await secureSessionSet(getFamilyTokenKey(familyId), result.token);

  try {
    await secureSessionSet(getFamilyExpiryKey(familyId), expiry);
  } catch (error) {
    await secureSessionRemove(getFamilyTokenKey(familyId));
    throw error;
  }

  // No aplicativo nativo, não manter cópias dos tokens no localStorage.
  if (isNativeHomeFin()) {
    localStorage.removeItem(getFamilyTokenKey(familyId));
    localStorage.removeItem(getFamilyExpiryKey(familyId));
  }
}

export async function clearFamilySession(
  familyId: string
): Promise<void> {
  if (!familyId) return;

  await Promise.all([
    secureSessionRemove(getFamilyTokenKey(familyId)),
    secureSessionRemove(getFamilyExpiryKey(familyId)),
  ]);

  localStorage.removeItem(getFamilyTokenKey(familyId));
  localStorage.removeItem(getFamilyExpiryKey(familyId));
}

export async function familyAuthRequest(
  familyId: string,
  payload: Record<string, unknown>,
  authenticated = false
): Promise<FamilyAuthResponse> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (authenticated) {
    const token = await getFamilySessionToken(familyId);

    if (!token) {
      throw new Error(
        'Sua sessão familiar expirou. Entre novamente.'
      );
    }

    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(homefinApiUrl('/api/family-auth'), {
    method: 'POST',
    headers,
    body: JSON.stringify({ ...payload, familyId }),
    cache: 'no-store',
  });

  const text = await response.text();

  let result: FamilyAuthResponse = {};

  try {
    result = text
      ? JSON.parse(text) as FamilyAuthResponse
      : {};
  } catch {
    throw new Error(
      'Resposta inválida do servidor de autenticação.'
    );
  }

  if (!response.ok) {
    throw new Error(
      result.error ||
      `Falha na autenticação (HTTP ${response.status}).`
    );
  }

  return result;
}

export async function verifyFamilySession(
  familyId: string
): Promise<boolean> {
  const result = await familyAuthRequest(
    familyId,
    { action: 'verify' },
    true
  );

  return result.valid === true;
}
