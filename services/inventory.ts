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
const ownerKey = (familyId: string) => `homefin_inventory_owner_${familyId}`;

function cacheFamilyIdFor(familyId: string): string {
  return localStorage.getItem(ownerKey(familyId)) || familyId;
}

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

async function assertCurrentOwner(
  familyId: string,
  expectedOwnerFamilyId: string
): Promise<void> {
  const current = await request(familyId, { action: 'list' });
  const actualOwner = String(current.ownerFamilyId || familyId);

  // Atualiza o vínculo somente com confirmação do servidor.
  localStorage.setItem(ownerKey(familyId), actualOwner);

  if (actualOwner !== expectedOwnerFamilyId) {
    throw new Error(
      'O acesso ao Estoque mudou. Seus dados particulares foram preservados; atualize a tela e tente novamente.'
    );
  }
}

async function syncPending(
  actingFamilyId: string,
  initial: InventoryCache,
  cacheId: string
): Promise<{ cache: InventoryCache; error?: string }> {
  let cache: InventoryCache = {
    products: [...initial.products],
    movements: [...initial.movements],
    pendingIds: [...initial.pendingIds],
    deletedIds: [...initial.deletedIds],
  };

  for (const id of [...cache.deletedIds]) {
    try {
      await request(actingFamilyId, { action: 'delete', id, expectedOwnerFamilyId: cacheId });
      cache.deletedIds = cache.deletedIds.filter(value => value !== id);
      writeCache(cacheId, cache);
    } catch (error) {
      return { cache, error: error instanceof Error ? error.message : 'Falha ao sincronizar exclusão.' };
    }
  }

  for (const id of [...cache.pendingIds]) {
    const product = cache.products.find(item => item.id === id);
    if (!product) {
      cache.pendingIds = cache.pendingIds.filter(value => value !== id);
      writeCache(cacheId, cache);
      continue;
    }
    try {
      const result = await request(actingFamilyId, { action: 'save', product, expectedOwnerFamilyId: cacheId });
      if (result.product) {
        cache.products = cache.products.map(item => item.id === id ? result.product : item);
      }
      cache.pendingIds = cache.pendingIds.filter(value => value !== id);
      writeCache(cacheId, cache);
    } catch (error) {
      return { cache, error: error instanceof Error ? error.message : 'Falha ao sincronizar produto.' };
    }
  }
  return { cache };
}

export const inventoryService = {
  async load(familyId: string): Promise<{
    data: InventoryData;
    synced: boolean;
    error?: string;
    sharing?: { ownerFamilyId: string; isOwner: boolean; sharedFamilies: Array<{familyId: string; createdAt: string}> };
  }> {
    let cacheId = cacheFamilyIdFor(familyId);
    let local = readCache(cacheId);

    if (!navigator.onLine) {
      return {
        data: cacheId === familyId ? local : emptyCache(),
        synced: false,
        error: cacheId === familyId
          ? 'Sem conexão. Exibindo o último Estoque particular disponível.'
          : 'Sem conexão para confirmar o acesso ao Estoque compartilhado. Os dados compartilhados foram ocultados temporariamente; seu Estoque particular foi preservado.',
      };
    }

    let result;
    try {
      result = await request(familyId, { action: 'list' });
    } catch (error) {
      return {
        data: cacheId === familyId ? local : emptyCache(),
        synced: false,
        error: cacheId === familyId
          ? (error instanceof Error ? error.message : 'Não foi possível acessar a nuvem.')
          : 'Não foi possível confirmar a autorização do Estoque compartilhado. Os dados compartilhados foram ocultados temporariamente; seu Estoque particular foi preservado.',
      };
    }

    const ownerFamilyId = String(result.ownerFamilyId || familyId);
    // Atualiza o vínculo somente depois da confirmação do servidor.
    localStorage.setItem(ownerKey(familyId), ownerFamilyId);
    cacheId = ownerFamilyId;
    local = readCache(cacheId);

    const productsById = new Map(
      (result.products || []).map((product: InventoryProduct) => [product.id, product])
    );
    for (const id of local.deletedIds) productsById.delete(id);
    for (const id of local.pendingIds) {
      const pending = local.products.find(product => product.id === id);
      if (pending) productsById.set(id, pending);
    }

    local = {
      ...local,
      products: [...productsById.values()],
      movements: result.movements || [],
    };
    writeCache(cacheId, local);

    const syncResult = await syncPending(familyId, local, cacheId);
    return {
      data: {
        products: syncResult.cache.products,
        movements: syncResult.cache.movements,
      },
      synced: !syncResult.error,
      error: syncResult.error,
      sharing: {
        ownerFamilyId,
        isOwner: Boolean(result.isOwner),
        sharedFamilies: Array.isArray(result.sharedFamilies) ? result.sharedFamilies : [],
      },
    };
  },

  async saveProduct(familyId: string, product: InventoryProduct) {
    let cacheId = cacheFamilyIdFor(familyId);
    if (navigator.onLine) {
      await assertCurrentOwner(familyId, cacheId);
      cacheId = cacheFamilyIdFor(familyId);
    }
    if (!navigator.onLine && cacheId !== familyId) {
      throw new Error('O Estoque compartilhado exige conexão. Seu Estoque particular foi preservado.');
    }
    const cache = readCache(cacheId);
    const next: InventoryCache = {
      ...cache,
      products: [product, ...cache.products.filter(item => item.id !== product.id)],
      pendingIds: [...new Set([...cache.pendingIds, product.id])],
      deletedIds: cache.deletedIds.filter(id => id !== product.id),
    };
    writeCache(cacheId, next);
    if (!navigator.onLine) {
      return { synced: false, data: next, error: 'Sem conexão. Produto salvo neste aparelho.' };
    }
    const result = await syncPending(familyId, next, cacheId);
    return { synced: !result.error, data: result.cache, error: result.error };
  },

  async deleteProduct(familyId: string, id: string) {
    let cacheId = cacheFamilyIdFor(familyId);
    if (navigator.onLine) {
      await assertCurrentOwner(familyId, cacheId);
      cacheId = cacheFamilyIdFor(familyId);
    }
    if (!navigator.onLine && cacheId !== familyId) {
      throw new Error('O Estoque compartilhado exige conexão. Seu Estoque particular foi preservado.');
    }
    const cache = readCache(cacheId);
    const wasPending = cache.pendingIds.includes(id);
    const next: InventoryCache = {
      ...cache,
      products: cache.products.filter(product => product.id !== id),
      pendingIds: cache.pendingIds.filter(value => value !== id),
      deletedIds: wasPending ? cache.deletedIds : [...new Set([...cache.deletedIds, id])],
    };
    writeCache(cacheId, next);
    if (!navigator.onLine) {
      return { synced: false, data: next, error: 'Exclusão salva localmente e aguardando conexão.' };
    }
    const result = await syncPending(familyId, next, cacheId);
    return { synced: !result.error, data: result.cache, error: result.error };
  },

  async moveBatch(
    familyId: string,
    items: Array<{ productId: string; quantity: number }>,
    note: string
  ) {
    if (!navigator.onLine) {
      throw new Error('Sem conexão. A baixa em lote não foi registrada.');
    }

    if (!Array.isArray(items) || items.length < 1 || items.length > 100) {
      throw new Error('A lista deve conter de 1 a 100 produtos.');
    }

    const ids = items.map(item => item.productId);
    if (new Set(ids).size !== ids.length) {
      throw new Error('A lista contém produtos repetidos.');
    }

    for (const item of items) {
      if (!Number.isInteger(item.quantity) || item.quantity < 1) {
        throw new Error('Confira as quantidades informadas.');
      }
    }

    let cacheId = cacheFamilyIdFor(familyId);
    await assertCurrentOwner(familyId, cacheId);
    cacheId = cacheFamilyIdFor(familyId);

    const cache = readCache(cacheId);

    // Não sincronizar pendências gerais aqui: isso poderia enviar
    // alterações locais que não fazem parte desta baixa.
    for (const id of ids) {
      if (cache.pendingIds.includes(id) || cache.deletedIds.includes(id)) {
        throw new Error(
          'Há produto selecionado aguardando sincronização. Atualize o Estoque e tente novamente.'
        );
      }

      const product = cache.products.find(item => item.id === id);
      if (!product) {
        throw new Error('Um produto não foi encontrado no estoque sincronizado. Atualize a tela.');
      }

      const requested = items.find(item => item.productId === id)!;
      if (requested.quantity > product.quantity) {
        throw new Error(
          `Estoque insuficiente para ${product.name}. Disponível: ${product.quantity}.`
        );
      }
    }

    // Uma única chamada ao servidor para todos os produtos.
    const result = await request(familyId, {
      action: 'move-batch',
      items,
      note,
      expectedOwnerFamilyId: cacheId,
    });

    if (
      !Array.isArray(result.products) ||
      !Array.isArray(result.movements) ||
      result.products.length !== items.length ||
      result.movements.length !== items.length
    ) {
      throw new Error('O servidor não confirmou a baixa completa. A lista foi preservada.');
    }

    const expectedIds = new Set(ids);

    if (
      result.products.some((product: InventoryProduct) => !expectedIds.has(product.id)) ||
      result.movements.some((movement: any) => !expectedIds.has(movement.productId)) ||
      new Set(result.products.map((product: InventoryProduct) => product.id)).size !== items.length ||
      new Set(result.movements.map((movement: any) => movement.productId)).size !== items.length
    ) {
      throw new Error('A confirmação recebida não corresponde à lista enviada. A lista foi preservada.');
    }

    const updated: InventoryCache = {
      ...cache,
      products: [
        ...result.products,
        ...cache.products.filter(product => !expectedIds.has(product.id)),
      ],
      movements: [
        ...result.movements,
        ...cache.movements.filter(
          movement => !result.movements.some((saved: any) => saved.id === movement.id)
        ),
      ],
    };

    // Cache só é atualizado depois da confirmação integral.
    writeCache(cacheId, updated);
    return result;
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
    let cacheId = cacheFamilyIdFor(familyId);
    await assertCurrentOwner(familyId, cacheId);
    cacheId = cacheFamilyIdFor(familyId);
    let cache = readCache(cacheId);
    if (cache.pendingIds.includes(productId) || cache.deletedIds.includes(productId)) {
      const syncResult = await syncPending(familyId, cache, cacheId);
      cache = syncResult.cache;
      if (syncResult.error) {
        writeCache(cacheId, cache);
        throw new Error('O produto ainda não foi sincronizado. Conecte-se e tente novamente.');
      }
    }
    const result = await request(familyId, {
      action: 'move',
      productId,
      type,
      quantity,
      note,
      expectedOwnerFamilyId: cacheId,
    });
    if (!result.product || !result.movement) {
      throw new Error('O servidor não confirmou a movimentação.');
    }
    const updated: InventoryCache = {
      ...cache,
      products: [result.product, ...cache.products.filter(item => item.id !== productId)],
      movements: [result.movement, ...cache.movements.filter(item => item.id !== result.movement.id)],
    };
    writeCache(cacheId, updated);
    return result;
  },
};
