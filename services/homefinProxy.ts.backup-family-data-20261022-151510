import type { AppData } from '../types';

type ProxyMethod = 'GET' | 'POST' | 'PATCH' | 'DELETE';

async function requestSupabase(
  path: string,
  method: ProxyMethod = 'GET',
  body?: unknown
): Promise<any> {
  const response = await fetch('/api/supabase', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      path,
      method,
      body,
    }),
  });

  const text = await response.text();

  let data: any = null;

  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }

  if (!response.ok) {
    throw new Error(
      data?.message ||
      data?.error ||
      `Erro no proxy Supabase: HTTP ${response.status}`
    );
  }

  return data;
}

export const homefinProxy = {
  getFamilyData: async (familyId: string): Promise<AppData | null> => {
    const data = await requestSupabase(
      `homefin_data?select=data&family_id=eq.${encodeURIComponent(familyId)}`
    );

    return data?.[0]?.data ?? null;
  },

  saveFamilyData: async (
    familyId: string,
    appData: AppData
  ): Promise<void> => {
    await requestSupabase(
      'homefin_data?on_conflict=family_id',
      'POST',
      {
        family_id: familyId,
        data: appData,
        updated_at: new Date().toISOString(),
      }
    );
  },

  familyExists: async (familyId: string): Promise<boolean> => {
    const data = await requestSupabase(
      `homefin_data?select=family_id&family_id=eq.${encodeURIComponent(familyId)}`
    );

    return Array.isArray(data) && data.length > 0;
  },
};
