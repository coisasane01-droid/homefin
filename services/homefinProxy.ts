import type { AppData } from '../types';

type FamilyAction = 'get' | 'save' | 'exists';

async function requestFamilyData(
  action: FamilyAction,
  familyId: string,
  data?: AppData
): Promise<any> {
  if (!familyId || familyId === 'v1') {
    throw new Error('Esta família precisa concluir a migração de segurança para sincronizar online.');
  }

  const tokenKey = `homefin_family_session_token_${familyId}`;
  const expiryKey = `homefin_family_session_expires_at_${familyId}`;
  const token = localStorage.getItem(tokenKey);
  const expiresAt = Number(localStorage.getItem(expiryKey) || 0);

  if (!token || !expiresAt || expiresAt <= Date.now()) {
    throw new Error('Sua sessão familiar expirou ou não está autenticada. Entre novamente com seu código.');
  }

  const response = await fetch('/api/family-data', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    cache: 'no-store',
    body: JSON.stringify({ action, familyId, ...(data ? { data } : {}) }),
  });

  const text = await response.text();
  let result: any = null;

  try {
    result = text ? JSON.parse(text) : null;
  } catch {
    result = null;
  }

  if (!response.ok) {
    throw new Error(
      result?.error || `Erro ao acessar dados familiares: HTTP ${response.status}`
    );
  }

  return result;
}

export const homefinProxy = {
  getFamilyData: async (familyId: string): Promise<AppData | null> => {
    const result = await requestFamilyData('get', familyId);
    return result?.data ?? null;
  },

  saveFamilyData: async (familyId: string, appData: AppData): Promise<void> => {
    await requestFamilyData('save', familyId, appData);
  },

  familyExists: async (familyId: string): Promise<boolean> => {
    const result = await requestFamilyData('exists', familyId);
    return result?.exists === true;
  },
};
