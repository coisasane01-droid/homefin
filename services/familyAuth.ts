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

export function getFamilySessionToken(familyId: string): string | null {
  if (!familyId || familyId === 'v1') return null;
  const token = localStorage.getItem(getFamilyTokenKey(familyId));
  const expiresAt = Number(localStorage.getItem(getFamilyExpiryKey(familyId)) || 0);
  return token && expiresAt > Date.now() ? token : null;
}

export function storeFamilySession(familyId: string, result: FamilyAuthResponse): void {
  if (!result.token || !Number.isFinite(Number(result.expiresIn))) {
    throw new Error('O servidor não confirmou a criação da sessão familiar.');
  }
  localStorage.setItem(getFamilyTokenKey(familyId), result.token);
  localStorage.setItem(
    getFamilyExpiryKey(familyId),
    String(Date.now() + Number(result.expiresIn) * 1000)
  );
}

export function clearFamilySession(familyId: string): void {
  if (!familyId) return;
  localStorage.removeItem(getFamilyTokenKey(familyId));
  localStorage.removeItem(getFamilyExpiryKey(familyId));
}

export async function familyAuthRequest(
  familyId: string,
  payload: Record<string, unknown>,
  authenticated = false
): Promise<FamilyAuthResponse> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (authenticated) {
    const token = getFamilySessionToken(familyId);
    if (!token) throw new Error('Sua sessão familiar expirou. Entre novamente.');
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch('/api/family-auth', {
    method: 'POST',
    headers,
    body: JSON.stringify({ ...payload, familyId }),
    cache: 'no-store',
  });
  const text = await response.text();
  let result: FamilyAuthResponse = {};
  try {
    result = text ? JSON.parse(text) as FamilyAuthResponse : {};
  } catch {
    throw new Error('Resposta inválida do servidor de autenticação.');
  }
  if (!response.ok) {
    throw new Error(result.error || `Falha na autenticação (HTTP ${response.status}).`);
  }
  return result;
}

export async function verifyFamilySession(familyId: string): Promise<boolean> {
  const result = await familyAuthRequest(familyId, { action: 'verify' }, true);
  return result.valid === true;
}
