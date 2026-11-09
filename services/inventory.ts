import type {
  InventoryData,
  InventoryProduct,
  InventoryMovementType,
} from '../types/inventory';

interface InventoryCache extends InventoryData {
  pendingIds: string[];
  deletedIds: string[];
}

const emptyCache = (): InventoryCache => ({
  products: [],
  movements: [],
  pendingIds: [],
  deletedIds: [],
});

const cacheKey = (familyId: string) => `homefin_inventory_${familyId}`;

function readCache(familyId: string): InventoryCache {
  try {
    const raw = localStorage.getItem(cacheKey(familyId));
    if (!raw) return emptyCache();

    const parsed = JSON.parse(raw);

    return {
      products: Array.isArray(parsed.products) ? parsed.products : [],
      movements: Array.isArray(parsed.movements) ? parsed.movements : [],
      pendingIds: Array.isArray(parsed.pendingIds) ? parsed.pendingIds : [],
      deletedIds: Array.isArray(parsed.deletedIds) ? parsed.deletedIds : [],
    };
  } catch {
    return emptyCache();
  }
}

function writeCache(familyId: string, data: InventoryCache): void {
  localStorage.setItem(cacheKey(familyId), JSON.stringify(data));
}

async function request(familyId: string, body: Record<string, unknown>) {
  const token = localStorage.getItem(`homefin_family_session_token_${familyId}`);
  const expiry = Number(
    localStorage.getItem(`homefin_family_session_expires_at_${familyId}`) || 0
  );

  if (!familyId || familyId === 'v1' || !token || expiry <= Date.now()) {
    throw new Error('Sessão familiar ausente ou expirada. Entre novamente.');
  }

  const response = await fetch('/api/inventory', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    cache: 'no-store',
    body: JSON.stringify({ ...body, familyId }),
  });

  const result = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(result.error || `Falha na sincronização (HTTP ${response.status}).`);
  }

  return result;
}

async function syncPending(
  familyId: string,
  initial: InventoryCache
): Promise<{ cache: InventoryCache; error?: string }> {
  let cache: InventoryCache = {
    products: [...initial.products],
    movements: [...initial.movements],
    pendingIds: [...initial.pendingIds],
    deletedIds: [...initial.deletedIds],
  };

  // Primeiro sincroniza exclusões confirmadas localmente.
  for (const id of [...cache.deletedIds]) {
    try {
      await request(familyId, { action: 'delete', id });

      cache.deletedIds = cache.deletedIds.filter(value => value !== id);
      writeCache(familyId, cache);
    } catch (error) {
      return {
        cache,
        error: error instanceof Error ? error.message : 'Falha ao sincronizar exclusão.',
      };
    }
  }

  // Depois sincroniza cadastros e edições pendentes.
  for (const id of [...cache.pendingIds]) {
    const product = cache.products.find(item => item.id === id);

    if (!product) {
      cache.pendingIds = cache.pendingIds.filter(value => value !== id);
      writeCache(familyId, cache);
      continue;
    }

    try {
      const result = await request(familyId, {
        action: 'save',
        product,
      });

      if (result.product) {
        cache.products = cache.products.map(item =>
          item.id === id ? result.product : item
        );
      }

      cache.pendingIds = cache.pendingIds.filter(value => value !== id);
      writeCache(familyId, cache);
    } catch (error) {
      return {
        cache,
        error: error instanceof Error ? error.message : 'Falha ao sincronizar produto.',
      };
    }
  }

  return { cache };
}

export const inventoryService = {
  async load(familyId: string): Promise<{
    data: InventoryData;
    synced: boolean;
    error?: string;
  }> {
    let local = readCache(familyId);

    if (!navigator.onLine) {
      return {
        data: local,
        synced: false,
        error: 'Sem conexão. Exibindo os dados locais.',
      };
    }

    let result;

    try {
      result = await request(familyId, { action: 'list' });
    } catch (error) {
      return {
        data: local,
        synced: false,
        error: error instanceof Error ? error.message : 'Não foi possível acessar a nuvem.',
      };
    }

    // A nuvem é mesclada com alterações locais pendentes.
    const productsById = new Map(
      (result.products || []).map((product: InventoryProduct) => [product.id, product])
    );

    for (const id of local.deletedIds) {
      productsById.delete(id);
    }

    for (const id of local.pendingIds) {
      const pending = local.products.find(product => product.id === id);
      if (pending) productsById.set(id, pending);
    }

    local = {
      ...local,
      products: [...productsById.values()],
      movements: result.movements || [],
    };

    writeCache(familyId, local);

    const syncResult = await syncPending(familyId, local);

    return {
      data: {
        products: syncResult.cache.products,
        movements: syncResult.cache.movements,
      },
      synced: !syncResult.error,
      error: syncResult.error,
    };
  },

  async saveProduct(familyId: string, product: InventoryProduct) {
    const cache = readCache(familyId);

    const next: InventoryCache = {
      ...cache,
      products: [
        product,
        ...cache.products.filter(item => item.id !== product.id),
      ],
      pendingIds: [...new Set([...cache.pendingIds, product.id])],
      deletedIds: cache.deletedIds.filter(id => id !== product.id),
    };

    // Salva localmente antes de tentar a nuvem.
    writeCache(familyId, next);

    if (!navigator.onLine) {
      return {
        synced: false,
        data: next,
        error: 'Sem conexão. Produto salvo neste aparelho.',
      };
    }

    const result = await syncPending(familyId, next);

    return {
      synced: !result.error,
      data: result.cache,
      error: result.error,
    };
  },

  async deleteProduct(familyId: string, id: string) {
    const cache = readCache(familyId);
    const wasPending = cache.pendingIds.includes(id);

    const next: InventoryCache = {
      ...cache,
      products: cache.products.filter(product => product.id !== id),
      pendingIds: cache.pendingIds.filter(value => value !== id),
      // Produto ainda não enviado à nuvem não precisa de exclusão remota.
      deletedIds: wasPending
        ? cache.deletedIds
        : [...new Set([...cache.deletedIds, id])],
    };

    writeCache(familyId, next);

    if (!navigator.onLine) {
      return {
        synced: false,
        data: next,
        error: 'Exclusão salva localmente e aguardando conexão.',
      };
    }

    const result = await syncPending(familyId, next);

    return {
      synced: !result.error,
      data: result.cache,
      error: result.error,
    };
  },

  async move(
    familyId: string,
    productId: string,
    type: InventoryMovementType,
    quantity: number,
    note: string
  ) {
    if (!navigator.onLine) {
      throw new Error('Sem conexão. A movimentação não foi registrada. Tente novamente quando estiver online.');
    }

    let cache = readCache(familyId);

    // Garante que o produto esteja na nuvem antes de movimentar seu saldo.
    if (cache.pendingIds.includes(productId) || cache.deletedIds.includes(productId)) {
      const syncResult = await syncPending(familyId, cache);

      cache = syncResult.cache;

      if (syncResult.error) {
        writeCache(familyId, cache);
        throw new Error('O produto ainda não foi sincronizado. Conecte-se e tente novamente.');
      }
    }

    const result = await request(familyId, {
      action: 'move',
      productId,
      type,
      quantity,
      note,
    });

    if (!result.product || !result.movement) {
      throw new Error('O servidor não confirmou a movimentação.');
    }

    const updated: InventoryCache = {
      ...cache,
      products: [
        result.product,
        ...cache.products.filter(item => item.id !== productId),
      ],
      movements: [
        result.movement,
        ...cache.movements.filter(item => item.id !== result.movement.id),
      ],
    };

    writeCache(familyId, updated);

    return result;
  },
};
