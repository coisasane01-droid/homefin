import type { HomeFinSpreadsheet } from '../types/spreadsheets';

type SpreadsheetAction = 'list' | 'upsert' | 'delete';

interface SpreadsheetCache {
  records: HomeFinSpreadsheet[];
  pendingIds: string[];
  deletedIds: string[];
}

export interface SpreadsheetLoadResult {
  records: HomeFinSpreadsheet[];
  synced: boolean;
  error?: string;
}

const cacheKey = (familyId: string) => `homefin_spreadsheets_${familyId}`;
const emptyCache = (): SpreadsheetCache => ({
  records: [],
  pendingIds: [],
  deletedIds: [],
});

function readCache(familyId: string): SpreadsheetCache {
  const raw = localStorage.getItem(cacheKey(familyId));
  if (!raw) return emptyCache();

  const parsed = JSON.parse(raw) as Partial<SpreadsheetCache>;
  return {
    records: Array.isArray(parsed.records) ? parsed.records : [],
    pendingIds: Array.isArray(parsed.pendingIds) ? parsed.pendingIds : [],
    deletedIds: Array.isArray(parsed.deletedIds) ? parsed.deletedIds : [],
  };
}

function writeCache(familyId: string, cache: SpreadsheetCache): void {
  localStorage.setItem(cacheKey(familyId), JSON.stringify(cache));
}

async function request(
  familyId: string,
  action: SpreadsheetAction,
  spreadsheet?: HomeFinSpreadsheet,
  id?: string
): Promise<HomeFinSpreadsheet[]> {
  const token = localStorage.getItem(`homefin_family_session_token_${familyId}`);
  const expiresAt = Number(
    localStorage.getItem(`homefin_family_session_expires_at_${familyId}`) || 0
  );

  if (!familyId || familyId === 'v1' || !token || expiresAt <= Date.now()) {
    throw new Error('Sua sessão familiar expirou ou não está autenticada. Entre novamente com seu código.');
  }

  const response = await fetch('/api/spreadsheets', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    cache: 'no-store',
    body: JSON.stringify({
      action,
      familyId,
      ...(spreadsheet ? { spreadsheet } : {}),
      ...(id ? { id } : {}),
    }),
  });

  const text = await response.text();
  let result: { records?: HomeFinSpreadsheet[]; error?: string } | null = null;
  try {
    result = text ? JSON.parse(text) : null;
  } catch {
    throw new Error('Resposta inválida ao sincronizar planilhas.');
  }

  if (!response.ok) {
    throw new Error(result?.error || `Falha ao sincronizar planilhas (HTTP ${response.status}).`);
  }

  return result?.records || [];
}

async function syncPending(
  familyId: string,
  initialCache: SpreadsheetCache
): Promise<{ cache: SpreadsheetCache; error?: string }> {
  const cache = {
    records: [...initialCache.records],
    pendingIds: [...initialCache.pendingIds],
    deletedIds: [...initialCache.deletedIds],
  };

  for (const id of [...cache.deletedIds]) {
    try {
      await request(familyId, 'delete', undefined, id);
      cache.deletedIds = cache.deletedIds.filter((deletedId) => deletedId !== id);
      writeCache(familyId, cache);
    } catch (error) {
      return {
        cache,
        error: error instanceof Error ? error.message : 'Falha ao sincronizar exclusão.',
      };
    }
  }

  for (const id of [...cache.pendingIds]) {
    const spreadsheet = cache.records.find((record) => record.id === id);
    if (!spreadsheet) continue;

    try {
      await request(familyId, 'upsert', spreadsheet);
      cache.pendingIds = cache.pendingIds.filter((pendingId) => pendingId !== id);
      writeCache(familyId, cache);
    } catch (error) {
      return {
        cache,
        error: error instanceof Error ? error.message : 'Falha ao sincronizar planilha.',
      };
    }
  }

  return { cache };
}

export const spreadsheetsService = {
  load: async (familyId: string): Promise<SpreadsheetLoadResult> => {
    let localCache: SpreadsheetCache;
    try {
      localCache = readCache(familyId);
    } catch (error) {
      throw new Error(
        error instanceof Error
          ? `Não foi possível ler o cache local de planilhas: ${error.message}`
          : 'Não foi possível ler o cache local de planilhas.'
      );
    }

    if (!navigator.onLine) {
      return { records: localCache.records, synced: false };
    }

    let remoteRecords: HomeFinSpreadsheet[];
    try {
      remoteRecords = await request(familyId, 'list');
    } catch (error) {
      return {
        records: localCache.records,
        synced: false,
        error: error instanceof Error ? error.message : 'Falha ao carregar planilhas da nuvem.',
      };
    }

    const recordsById = new Map(remoteRecords.map((record) => [record.id, record]));
    for (const id of localCache.deletedIds) recordsById.delete(id);
    for (const id of localCache.pendingIds) {
      const localRecord = localCache.records.find((record) => record.id === id);
      if (localRecord) recordsById.set(id, localRecord);
    }

    const mergedCache = {
      records: [...recordsById.values()].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
      pendingIds: localCache.pendingIds,
      deletedIds: localCache.deletedIds,
    };
    writeCache(familyId, mergedCache);

    const syncResult = await syncPending(familyId, mergedCache);
    if (syncResult.error) {
      return { records: syncResult.cache.records, synced: false, error: syncResult.error };
    }

    return { records: syncResult.cache.records, synced: true };
  },

  save: async (
    familyId: string,
    spreadsheet: HomeFinSpreadsheet
  ): Promise<{ synced: boolean; error?: string }> => {
    const cache = readCache(familyId);
    const updated = { ...spreadsheet, updatedAt: new Date().toISOString() };
    const nextCache: SpreadsheetCache = {
      records: [updated, ...cache.records.filter((record) => record.id !== updated.id)],
      pendingIds: [...new Set([...cache.pendingIds, updated.id])],
      deletedIds: cache.deletedIds.filter((id) => id !== updated.id),
    };
    writeCache(familyId, nextCache);

    if (!navigator.onLine) return { synced: false };

    try {
      await request(familyId, 'upsert', updated);
      writeCache(familyId, {
        ...nextCache,
        pendingIds: nextCache.pendingIds.filter((id) => id !== updated.id),
      });
      return { synced: true };
    } catch (error) {
      return {
        synced: false,
        error: error instanceof Error ? error.message : 'Falha ao salvar planilha na nuvem.',
      };
    }
  },

  delete: async (
    familyId: string,
    id: string
  ): Promise<{ synced: boolean; error?: string }> => {
    const cache = readCache(familyId);
    const nextCache: SpreadsheetCache = {
      records: cache.records.filter((record) => record.id !== id),
      pendingIds: cache.pendingIds.filter((pendingId) => pendingId !== id),
      deletedIds: [...new Set([...cache.deletedIds, id])],
    };
    writeCache(familyId, nextCache);

    if (!navigator.onLine) return { synced: false };

    try {
      await request(familyId, 'delete', undefined, id);
      writeCache(familyId, {
        ...nextCache,
        deletedIds: nextCache.deletedIds.filter((deletedId) => deletedId !== id),
      });
      return { synced: true };
    } catch (error) {
      return {
        synced: false,
        error: error instanceof Error ? error.message : 'Falha ao excluir planilha da nuvem.',
      };
    }
  },
};
