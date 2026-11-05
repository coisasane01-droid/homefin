import type { AppData } from '../types';

type FamilyAction = 'get' | 'save' | 'exists';

export class FamilyDataConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FamilyDataConflictError';
  }
}

async function requestFamilyData(
  action: FamilyAction,
  familyId: string,
  data?: AppData,
  expectedUpdatedAt?: string | null
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
    body: JSON.stringify({
      action,
      familyId,
      ...(data ? { data, expectedUpdatedAt } : {}),
    }),
  });

  const text = await response.text();
  let result: any = null;

  try {
    result = text ? JSON.parse(text) : null;
  } catch {
    result = null;
  }

  if (!response.ok) {
    if (response.status === 409) {
      throw new FamilyDataConflictError(
        result?.error || 'A nuvem contém uma versão mais recente. Os dados locais foram preservados.'
      );
    }
    throw new Error(
      result?.error || `Erro ao acessar dados familiares: HTTP ${response.status}`
    );
  }

  return result;
}

export const homefinProxy = {
  getFamilyData: async (
    familyId: string
  ): Promise<{ data: AppData | null; updatedAt: string | null }> => {
    const result = await requestFamilyData('get', familyId);
    return {
      data: result?.data ?? null,
      updatedAt: result?.updatedAt ?? null,
    };
  },

  saveFamilyData: async (
    familyId: string,
    appData: AppData,
    expectedUpdatedAt: string | null
  ): Promise<string> => {
    const result = await requestFamilyData('save', familyId, appData, expectedUpdatedAt);
    if (typeof result?.updatedAt !== 'string') {
      throw new Error('O Supabase não confirmou a versão dos dados salvos.');
    }
    return result.updatedAt;
  },

  familyExists: async (familyId: string): Promise<boolean> => {
    const result = await requestFamilyData('exists', familyId);
    return result?.exists === true;
  },
};
