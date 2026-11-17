import type {
  InventoryData,
  InventoryProduct,
  InventoryMovementType,
} from '../types/inventory';

interface InventoryCache extends InventoryData {
  pendingIds: string[];
  deletedIds: string[];
  deletedVersions: Record<string, string>;
  conflictIds: string[];
  conflictProducts: InventoryProduct[];
}

const emptyCache = (): InventoryCache => ({
  products: [],
  movements: [],
  pendingIds: [],
  deletedIds: [],
  deletedVersions: {},
  conflictIds: [],
  conflictProducts: [],
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
      products: Array.isArray(parsed.products)
        ? parsed.products.map((product: InventoryProduct) => ({
            ...product,
            quantityMode: product.quantityMode === 'decimal' ? 'decimal' : 'integer',
          }))
        : [],
      movements: Array.isArray(parsed.movements) ? parsed.movements : [],
      pendingIds: Array.isArray(parsed.pendingIds) ? parsed.pendingIds : [],
      deletedIds: Array.isArray(parsed.deletedIds) ? parsed.deletedIds : [],
      deletedVersions: parsed.deletedVersions && typeof parsed.deletedVersions === 'object' &&
        !Array.isArray(parsed.deletedVersions) ? parsed.deletedVersions : {},
      conflictIds: Array.isArray(parsed.conflictIds) ? parsed.conflictIds : [],
      conflictProducts: Array.isArray(parsed.conflictProducts)
        ? parsed.conflictProducts
        : [],
    };
  } catch (error) {
    console.error(
      'HomeFin: falha ao ler o cache do Estoque.',
      error
    );

    throw new Error(
      'Não foi possível ler os dados locais do Estoque. ' +
      'Nenhuma alteração foi descartada. ' +
      'Não limpe os dados do navegador; procure o suporte.'
    );
  }
}

function writeCache(familyId: string, data: InventoryCache): void {
  localStorage.setItem(cacheKey(familyId), JSON.stringify(data));
}

interface PendingInventoryOperation {
  operationId: string;
  familyId: string;
  ownerFamilyId: string;
  action: 'move' | 'move-batch';
  payload: Record<string, unknown>;
  createdAt: string;
}

const pendingOperationKey = (familyId: string) =>
  `homefin_inventory_pending_operation_${familyId}`;

function readPendingOperation(familyId: string): PendingInventoryOperation | null {
  const raw = localStorage.getItem(pendingOperationKey(familyId));
  if (!raw) return null;

  try {
    const parsed: unknown = JSON.parse(raw);

    if (!parsed || typeof parsed !== 'object') {
      throw new Error('Formato inválido.');
    }

    const value = parsed as Partial<PendingInventoryOperation>;

    if (
      typeof value.operationId !== 'string' ||
      value.familyId !== familyId ||
      typeof value.ownerFamilyId !== 'string' ||
      !['move', 'move-batch'].includes(String(value.action)) ||
      !value.payload ||
      typeof value.payload !== 'object' ||
      Array.isArray(value.payload)
    ) {
      throw new Error('Dados incompletos.');
    }

    return value as PendingInventoryOperation;
  } catch {
    throw new Error(
      'Existe uma operação de Estoque pendente com dados inválidos. ' +
      'Não limpe os dados do navegador e não repita a baixa.'
    );
  }
}

function savePendingOperation(operation: PendingInventoryOperation): void {
  localStorage.setItem(
    pendingOperationKey(operation.familyId),
    JSON.stringify(operation)
  );
}

function clearPendingOperation(familyId: string, operationId: string): void {
  const current = readPendingOperation(familyId);

  if (current?.operationId === operationId) {
    localStorage.removeItem(pendingOperationKey(familyId));
  }
}

function beginInventoryOperation(
  familyId: string,
  ownerFamilyId: string,
  action: 'move' | 'move-batch',
  payload: Record<string, unknown>
): PendingInventoryOperation {
  const existing = readPendingOperation(familyId);

  if (existing) {
    throw new Error(
      'Existe uma movimentação anterior aguardando confirmação. ' +
      'Não repita a baixa. Será necessário recuperar a operação original.'
    );
  }

  if (!globalThis.crypto?.randomUUID) {
    throw new Error('Este dispositivo não permite gerar um identificador seguro.');
  }

  const operation: PendingInventoryOperation = {
    operationId: globalThis.crypto.randomUUID(),
    familyId,
    ownerFamilyId,
    action,
    payload,
    createdAt: new Date().toISOString(),
  };

  savePendingOperation(operation);
  return operation;
}

// Impede recuperações simultâneas da mesma família nesta instância.
const inventoryRecoveryLocks = new Map<string, Promise<boolean>>();

async function recoverPendingInventoryOperation(
  familyId: string
): Promise<boolean> {
  const running = inventoryRecoveryLocks.get(familyId);
  if (running) return running;

  const work = (async (): Promise<boolean> => {
    const pending = readPendingOperation(familyId);
    if (!pending) return false;

    if (!navigator.onLine) {
      throw new Error(
        'Existe uma movimentação pendente. Conecte-se para recuperar.'
      );
    }

    // Confirma a autorização antes de recuperar.
    const access = await request(familyId, { action: 'list' });
    const owner = String(access.ownerFamilyId || familyId);

    if (owner !== pending.ownerFamilyId) {
      throw new Error(
        'O compartilhamento mudou. A operação permanece pendente.'
      );
    }

    // Somente a API idempotente pode receber esta repetição.
    // Reutiliza exatamente o UUID e os dados originais.
    const result = await request(familyId, {
      action: pending.action,
      ...pending.payload,
      operationId: pending.operationId,
      expectedOwnerFamilyId: pending.ownerFamilyId,
    });

    if (pending.action === 'move') {
      if (
        !result.product ||
        !result.movement ||
        result.product.id !== pending.payload.productId ||
        result.movement.productId !== pending.payload.productId
      ) {
        throw new Error('Confirmação individual inválida.');
      }
    } else {
      const items = pending.payload.items;

      if (
        !Array.isArray(items) ||
        !Array.isArray(result.products) ||
        !Array.isArray(result.movements) ||
        result.products.length !== items.length ||
        result.movements.length !== items.length
      ) {
        throw new Error('Confirmação do lote incompleta.');
      }

      const ids = new Set(items.map(
        (item: { productId: string }) => item.productId
      ));

      if (
        ids.size !== items.length ||
        new Set(result.products.map(
          (item: InventoryProduct) => item.id
        )).size !== items.length ||
        new Set(result.movements.map(
          (item: { productId: string }) => item.productId
        )).size !== items.length ||
        result.products.some(
          (item: InventoryProduct) => !ids.has(item.id)
        ) ||
        result.movements.some(
          (item: { productId: string }) => !ids.has(item.productId)
        )
      ) {
        throw new Error('A confirmação não corresponde ao lote original.');
      }
    }

    // Obtém os saldos atuais, não os saldos antigos da operação.
    const refreshed = await request(familyId, { action: 'list' });

    if (
      String(refreshed.ownerFamilyId || familyId) !== pending.ownerFamilyId ||
      !Array.isArray(refreshed.products) ||
      !Array.isArray(refreshed.movements)
    ) {
      throw new Error('Não foi possível confirmar o estoque atualizado.');
    }

    // Não substitui produtos com alterações locais ainda não sincronizadas.
    const cache = readCache(pending.ownerFamilyId);
    const productsById = new Map<string, InventoryProduct>(
      refreshed.products.map(
        (product: InventoryProduct): [string, InventoryProduct] =>
          [product.id, product]
      )
    );

    for (const id of cache.deletedIds) {
      productsById.delete(id);
    }

    for (const id of [...cache.pendingIds, ...cache.conflictIds]) {
      const localProduct = cache.products.find(item => item.id === id);
      if (localProduct) productsById.set(id, localProduct);
    }

    // Impede limpar um registro que tenha mudado durante a recuperação.
    const latest = readPendingOperation(familyId);
    if (
      !latest ||
      latest.operationId !== pending.operationId ||
      latest.ownerFamilyId !== pending.ownerFamilyId
    ) {
      throw new Error('A operação pendente mudou durante a recuperação.');
    }

    const updated: InventoryCache = {
      ...cache,
      products: [...productsById.values()],
      movements: refreshed.movements,
    };

    writeCache(pending.ownerFamilyId, updated);
    clearPendingOperation(familyId, pending.operationId);

    return true;
  })();

  inventoryRecoveryLocks.set(familyId, work);

  try {
    return await work;
  } finally {
    if (inventoryRecoveryLocks.get(familyId) === work) {
      inventoryRecoveryLocks.delete(familyId);
    }
  }
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
    const message = typeof result.error === 'string'
      ? result.error
      : `Falha na sincronização (HTTP ${response.status}).`;

    const error = new Error(message) as Error & {
      status?: number;
      code?: string;
    };

    error.status = response.status;
    error.code = typeof result.code === 'string'
      ? result.code
      : undefined;

    throw error;
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
  const latest = () => readCache(cacheId);

  const changed = (before: InventoryCache, after: InventoryCache) =>
    JSON.stringify(before) !== JSON.stringify(after);

  let cache = latest();

  for (const id of [...cache.deletedIds]) {
    cache = latest();

    if (!cache.deletedIds.includes(id)) continue;

    const before = cache;
    const expectedUpdatedAt = cache.deletedVersions[id];
    if (typeof expectedUpdatedAt !== 'string' ||
        !Number.isFinite(Date.parse(expectedUpdatedAt))) {
      return {
        cache,
        error: 'Exclusão offline antiga sem versão verificável. Nenhuma exclusão foi enviada. ' +
          'Preserve os dados locais e procure suporte para conciliar este produto.',
      };
    }

    try {
      await request(actingFamilyId, {
        action: 'delete',
        id,
        expectedUpdatedAt,
        expectedOwnerFamilyId: cacheId,
      });

      const current = latest();

      if (changed(before, current)) {
        return {
          cache: current,
          error:
            'O estoque local mudou durante a exclusão. ' +
            'Atualize para reconciliar os dados antes de continuar.',
        };
      }

      const updated: InventoryCache = {
        ...current,
        deletedIds: current.deletedIds.filter(value => value !== id),
        deletedVersions: Object.fromEntries(
          Object.entries(current.deletedVersions).filter(([key]) => key !== id)
        ),
      };

      writeCache(cacheId, updated);
    } catch (error) {
      return {
        cache: latest(),
        error: error instanceof Error
          ? error.message
          : 'Falha ao sincronizar exclusão.',
      };
    }
  }

  cache = latest();

  for (const id of [...cache.pendingIds]) {
    cache = latest();

    if (!cache.pendingIds.includes(id)) continue;
    if (cache.conflictIds.includes(id)) continue;

    const product = cache.products.find(item => item.id === id);

    if (!product) {
      return {
        cache,
        error:
          'Produto pendente não encontrado. ' +
          'A sincronização foi interrompida para preservar os dados.',
      };
    }

    const before = cache;

    try {
      const {
        photoStoragePath: _photoStoragePath,
        ...productPayload
      } = product;

      const result = await request(actingFamilyId, {
        action: 'save',
        product: productPayload,
        expectedOwnerFamilyId: cacheId,
      });

      const current = latest();

      if (changed(before, current)) {
        return {
          cache: current,
          error:
            'O estoque local mudou durante o salvamento. ' +
            'As alterações recentes foram preservadas. ' +
            'Atualize antes de continuar.',
        };
      }

      if (!result.product) {
        return {
          cache: current,
          error:
            'O servidor não confirmou o produto salvo. ' +
            'A pendência foi preservada.',
        };
      }

      const updated: InventoryCache = {
        ...current,
        products: current.products.map(item =>
          item.id === id ? result.product : item
        ),
        pendingIds: current.pendingIds.filter(value => value !== id),
      };

      writeCache(cacheId, updated);
    } catch (error) {
      const current = latest();

      const message = error instanceof Error
        ? error.message
        : 'Falha ao sincronizar produto.';

      const requestError = error as Error & {
        status?: number;
        code?: string;
      };

      const isVersionConflict =
        requestError.code === 'INVENTORY_VERSION_CONFLICT' ||
        message.includes('alterado em outro aparelho') ||
        message.includes('Atualize o produto antes de editar');

      if (isVersionConflict) {
        if (changed(before, current)) {
          return {
            cache: current,
            error:
              'Conflito remoto detectado enquanto o estoque local mudou. ' +
              'Nenhuma versão local foi descartada. Atualize o Estoque.',
          };
        }

        const updated: InventoryCache = {
          ...current,
          conflictIds: [
            ...new Set([...current.conflictIds, id]),
          ],
          conflictProducts: [
            ...current.conflictProducts.filter(item => item.id !== id),
            product,
          ],
          pendingIds: current.pendingIds.filter(value => value !== id),
        };

        writeCache(cacheId, updated);

        return {
          cache: updated,
          error:
            'Conflito detectado. A versão local foi preservada ' +
            'para comparação com o Supabase.',
        };
      }

      return { cache: current, error: message };
    }
  }

  return { cache: latest() };
}

export const inventoryService = {
  async setArchived(familyId: string, product: InventoryProduct, archived: boolean): Promise<InventoryProduct> {
    if (!navigator.onLine) throw new Error('Arquivar e restaurar exigem conexão com o Supabase.');
    const ownerFamilyId = cacheFamilyIdFor(familyId);
    await assertCurrentOwner(familyId, ownerFamilyId);
    const cache = readCache(ownerFamilyId);
    if (cache.pendingIds.includes(product.id) || cache.deletedIds.includes(product.id) ||
        cache.conflictIds.includes(product.id) || readPendingOperation(familyId)) {
      throw new Error('Existem alterações pendentes. Sincronize o Estoque antes de continuar.');
    }
    const result = await request(familyId, {
      action: 'set-archived', id: product.id, archived,
      expectedUpdatedAt: product.updatedAt, expectedOwnerFamilyId: ownerFamilyId,
    });
    if (!result?.product || result.product.id !== product.id) {
      throw new Error('O servidor não confirmou o arquivamento.');
    }
    const latest = readCache(ownerFamilyId);
    if (JSON.stringify(latest) !== JSON.stringify(cache)) {
      throw new Error(
        'O servidor confirmou a operação, mas o estoque local mudou durante a requisição. ' +
        'Os dados locais foram preservados. Atualize o Estoque para conciliar.'
      );
    }

    writeCache(ownerFamilyId, {
      ...latest,
      products: latest.products.map(item =>
        item.id === product.id ? result.product : item
      ),
    });
    return result.product as InventoryProduct;
  },

  async deleteConfirmed(familyId: string, product: InventoryProduct): Promise<void> {
    if (!navigator.onLine) throw new Error('A exclusão exige conexão com o Supabase.');
    const ownerFamilyId = cacheFamilyIdFor(familyId);
    await assertCurrentOwner(familyId, ownerFamilyId);
    const cache = readCache(ownerFamilyId);
    if (cache.pendingIds.includes(product.id) || cache.deletedIds.includes(product.id) ||
        cache.conflictIds.includes(product.id) || readPendingOperation(familyId)) {
      throw new Error('Existem alterações pendentes. Sincronize o Estoque antes de excluir.');
    }
    await request(familyId, { action: 'delete', id: product.id, expectedUpdatedAt: product.updatedAt, expectedOwnerFamilyId: ownerFamilyId });
    const latest = readCache(ownerFamilyId);
    if (JSON.stringify(latest) !== JSON.stringify(cache)) {
      throw new Error(
        'O servidor confirmou a exclusão, mas o estoque local mudou durante a requisição. ' +
        'Os dados locais foram preservados. Atualize o Estoque para conciliar.'
      );
    }
    writeCache(ownerFamilyId, { ...latest,
      products: latest.products.filter(item => item.id !== product.id),
    });
  },

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

    // Recupera a operação original antes de sincronizar o Estoque.
    // Se a confirmação falhar, mantém o registro e bloqueia novas baixas.
    try {
      await recoverPendingInventoryOperation(familyId);
    } catch (error) {
      return {
        data: cacheId === familyId ? readCache(cacheId) : emptyCache(),
        synced: false,
        error:
          'Existe uma movimentação aguardando recuperação. ' +
          (error instanceof Error ? error.message : 'Confira a conexão.') +
          ' Não repita a baixa.',
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

    // Captura versões locais conflitantes antes de mesclar dados remotos.
    const legacyConflictProducts = local.products.filter(
      product =>
        local.conflictIds.includes(product.id) &&
        !local.conflictProducts.some(saved => saved.id === product.id)
    );

    local.conflictProducts = [
      ...local.conflictProducts,
      ...legacyConflictProducts,
    ];

    const productsById = new Map<string, InventoryProduct>(
      (result.products || []).map(
        (product: InventoryProduct): [string, InventoryProduct] =>
          [product.id, product]
      )
    );
    for (const id of local.deletedIds) productsById.delete(id);
    // Pendências normais continuam visíveis durante a sincronização.
    for (const id of local.pendingIds) {
      const pending = local.products.find(product => product.id === id);
      if (pending) productsById.set(id, pending);
    }

    // Produtos em conflito preservam a versão local no cache,
    // mas não substituem a versão confirmada pelo servidor.
    // Preserva conflitos antigos em armazenamento separado.
    // Compatibilidade com caches criados antes desta alteração.
    const conflictProducts = [...local.conflictProducts];

    local = {
      ...local,
      products: [...productsById.values()],
      conflictProducts,
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

  async listConflicts(familyId: string) {
    if (!navigator.onLine) {
      throw new Error(
        'Conecte-se à internet para comparar conflitos com o Supabase.'
      );
    }

    const expectedOwner = cacheFamilyIdFor(familyId);
    await assertCurrentOwner(familyId, expectedOwner);

    const cacheId = cacheFamilyIdFor(familyId);
    const cache = readCache(cacheId);

    // Consulta somente. Não sincroniza alterações pendentes.
    const remote = await request(familyId, { action: 'list' });

    if (String(remote.ownerFamilyId || familyId) !== cacheId) {
      throw new Error(
        'O compartilhamento do Estoque mudou. Atualize a página.'
      );
    }

    const remoteProducts: InventoryProduct[] =
      Array.isArray(remote.products) ? remote.products : [];

    return cache.conflictIds.map(id => ({
      id,
      local: cache.conflictProducts.find(item => item.id === id)
        || cache.products.find(item => item.id === id)
        || null,
      remote: remoteProducts.find(item => item.id === id) || null,
    }));
  },

  async acceptRemoteConflict(
    familyId: string,
    productId: string,
    expectedRemoteUpdatedAt: string
  ) {
    if (!navigator.onLine) {
      throw new Error(
        'Conecte-se à internet para resolver este conflito.'
      );
    }

    const expectedOwner = cacheFamilyIdFor(familyId);
    await assertCurrentOwner(familyId, expectedOwner);

    const cacheId = cacheFamilyIdFor(familyId);
    const initialCache = readCache(cacheId);

    if (!initialCache.conflictIds.includes(productId)) {
      throw new Error('Conflito não encontrado. Atualize o Estoque.');
    }

    const initialLocal = initialCache.conflictProducts.find(
      item => item.id === productId
    );

    if (!initialLocal) {
      throw new Error(
        'A versão local não está disponível. ' +
        'Nenhuma alteração será descartada.'
      );
    }

    const conflicts = await this.listConflicts(familyId);
    const conflict = conflicts.find(item => item.id === productId);

    if (!conflict) {
      throw new Error(
        'Conflito não encontrado. Atualize o Estoque.'
      );
    }

    if (!conflict.remote) {
      throw new Error(
        'O produto não existe mais no Supabase. ' +
        'A versão local foi preservada para análise.'
      );
    }

    if (
      !expectedRemoteUpdatedAt ||
      conflict.remote.updatedAt !== expectedRemoteUpdatedAt
    ) {
      throw new Error(
        'O produto foi alterado no Supabase após a comparação. ' +
        'Consulte novamente antes de confirmar.'
      );
    }

    const cache = readCache(cacheId);

    if (!cache.conflictIds.includes(productId)) {
      throw new Error(
        'O conflito já foi resolvido ou alterado. Atualize a tela.'
      );
    }

    if (
      cache.pendingIds.includes(productId) ||
      cache.deletedIds.includes(productId)
    ) {
      throw new Error(
        'Existem operações pendentes neste produto. ' +
        'Não é possível descartar a versão local.'
      );
    }

    const currentLocal = cache.conflictProducts.find(
      item => item.id === productId
    );

    if (
      !currentLocal ||
      JSON.stringify(currentLocal) !== JSON.stringify(initialLocal)
    ) {
      throw new Error(
        'A versão local mudou durante a consulta. ' +
        'Atualize a comparação antes de resolver.'
      );
    }

    const updated: InventoryCache = {
      ...cache,
      products: [
        conflict.remote,
        ...cache.products.filter(item => item.id !== productId),
      ],
      conflictIds: cache.conflictIds.filter(id => id !== productId),
      conflictProducts: cache.conflictProducts.filter(
        item => item.id !== productId
      ),
    };

    writeCache(cacheId, updated);

    return {
      product: conflict.remote,
      message: 'Versão do Supabase mantida neste aparelho.',
    };
  },

  async setFavorite(
    familyId: string,
    productId: string,
    favorite: boolean,
    expectedUpdatedAt: string
  ): Promise<InventoryProduct> {
    if (!navigator.onLine) {
      throw new Error(
        'É necessária conexão para atualizar os favoritos.'
      );
    }

    let cacheId = cacheFamilyIdFor(familyId);
    await assertCurrentOwner(familyId, cacheId);
    cacheId = cacheFamilyIdFor(familyId);

    const cache = readCache(cacheId);

    if (
      cache.conflictIds.includes(productId) ||
      cache.pendingIds.includes(productId) ||
      cache.deletedIds.includes(productId)
    ) {
      throw new Error(
        'Este produto possui alterações pendentes ou em conflito. ' +
        'Resolva antes de alterar o favorito.'
      );
    }

    const result = await request(familyId, {
      action: 'set-favorite',
      productId,
      favorite,
      expectedUpdatedAt,
      expectedOwnerFamilyId: cacheId,
    });

    if (!result?.product) {
      throw new Error(
        'O servidor não confirmou a atualização do favorito.'
      );
    }

    const current = readCache(cacheId);

    if (
      current.conflictIds.includes(productId) ||
      current.pendingIds.includes(productId) ||
      current.deletedIds.includes(productId)
    ) {
      throw new Error(
        'O favorito foi atualizado no servidor, mas existem ' +
        'alterações locais pendentes. Atualize o estoque.'
      );
    }

    const updated = result.product as InventoryProduct;

    writeCache(cacheId, {
      ...current,
      products: current.products.map(product =>
        product.id === productId
          ? {
              ...product,
              favorite: Boolean(updated.favorite),
              updatedAt: updated.updatedAt,
            }
          : product
      ),
    });

    return updated;
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

    if (cache.conflictIds.includes(product.id)) {
      throw new Error(
        'Este produto possui uma alteração em conflito com outro aparelho. ' +
        'A versão local foi preservada. Resolva o conflito antes de salvar novamente.'
      );
    }

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

    if (cache.conflictIds.includes(id)) {
      throw new Error(
        'Este produto possui alterações em conflito. ' +
        'A exclusão foi bloqueada para preservar os dados. ' +
        'Resolva o conflito antes de excluir.'
      );
    }

    const product = cache.products.find(item => item.id === id);
    if (!product) throw new Error('Produto não encontrado no cache. Atualize o Estoque.');
    if (cache.pendingIds.includes(id)) {
      throw new Error('Produto com alterações locais pendentes. Sincronize antes de excluir.');
    }
    if (cache.deletedIds.includes(id)) {
      throw new Error('Este produto já possui uma exclusão pendente.');
    }
    if (!product.updatedAt || !Number.isFinite(Date.parse(product.updatedAt))) {
      throw new Error('Produto sem versão verificável. Sincronize antes de excluir.');
    }
    const next: InventoryCache = {
      ...cache,
      products: cache.products.filter(item => item.id !== id),
      deletedIds: [...cache.deletedIds, id],
      deletedVersions: { ...cache.deletedVersions, [id]: product.updatedAt },
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
      if (
        !Number.isFinite(item.quantity) ||
        item.quantity <= 0 ||
        item.quantity > 100000000 ||
        Math.abs(item.quantity * 1000 - Math.round(item.quantity * 1000)) >= 1e-7
      ) {
        throw new Error('Confira as quantidades. Use até três casas decimais.');
      }
    }

    let cacheId = cacheFamilyIdFor(familyId);
    await assertCurrentOwner(familyId, cacheId);
    cacheId = cacheFamilyIdFor(familyId);

    const cache = readCache(cacheId);

    // Não sincronizar pendências gerais aqui: isso poderia enviar
    // alterações locais que não fazem parte desta baixa.
    for (const id of ids) {
      if (
        cache.pendingIds.includes(id) ||
        cache.deletedIds.includes(id) ||
        cache.conflictIds.includes(id)
      ) {
        throw new Error(
          'Há produto selecionado aguardando sincronização. Atualize o Estoque e tente novamente.'
        );
      }

      const product = cache.products.find(item => item.id === id);
      if (!product) {
        throw new Error('Um produto não foi encontrado no estoque sincronizado. Atualize a tela.');
      }

      const requested = items.find(item => item.productId === id)!;
      const quantityMode = product.quantityMode || 'integer';
      if (quantityMode === 'integer' && !Number.isInteger(requested.quantity)) {
        throw new Error(`${product.name} aceita somente quantidades inteiras.`);
      }
      if (requested.quantity > product.quantity) {
        throw new Error(
          `Estoque insuficiente para ${product.name}. Disponível: ${product.quantity}.`
        );
      }
    }

    // Registrar a operação antes do envio para impedir repetição acidental.
    const operation = beginInventoryOperation(
      familyId,
      cacheId,
      'move-batch',
      { items, note }
    );

    const result = await request(familyId, {
      action: 'move-batch',
      items,
      note,
      operationId: operation.operationId,
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

    const current = readCache(cacheId);

    const changedProducts = ids.some(id => {
      const before = cache.products.find(item => item.id === id);
      const after = current.products.find(item => item.id === id);

      return JSON.stringify(before) !== JSON.stringify(after) ||
        current.pendingIds.includes(id) ||
        current.deletedIds.includes(id) ||
        current.conflictIds.includes(id);
    });

    if (changedProducts) {
      throw new Error(
        'A baixa foi confirmada pelo servidor, mas o produto mudou ' +
        'localmente durante a operação. Não repita a baixa. ' +
        'Atualize o Estoque para reconciliar os dados.'
      );
    }

    const updated: InventoryCache = {
      ...current,
      products: [
        ...result.products,
        ...current.products.filter(product => !expectedIds.has(product.id)),
      ],
      movements: [
        ...result.movements,
        ...current.movements.filter(
          movement => !result.movements.some((saved: any) => saved.id === movement.id)
        ),
      ],
    };

    writeCache(cacheId, updated);
    clearPendingOperation(familyId, operation.operationId);
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

    if (cache.conflictIds.includes(productId)) {
      throw new Error(
        'Este produto possui alterações em conflito. ' +
        'Resolva o conflito antes de movimentar o estoque.'
      );
    }

    if (cache.pendingIds.includes(productId) || cache.deletedIds.includes(productId)) {
      const syncResult = await syncPending(familyId, cache, cacheId);
      cache = syncResult.cache;
      if (syncResult.error) {
        writeCache(cacheId, cache);
        throw new Error('O produto ainda não foi sincronizado. Conecte-se e tente novamente.');
      }
    }
    const product = cache.products.find(item => item.id === productId);
    if (!product) {
      throw new Error('Produto não encontrado no estoque sincronizado.');
    }
    const quantityMode = product.quantityMode || 'integer';
    if (
      !Number.isFinite(quantity) ||
      quantity <= 0 ||
      quantity > 100000000 ||
      Math.abs(quantity * 1000 - Math.round(quantity * 1000)) >= 1e-7 ||
      (quantityMode === 'integer' && !Number.isInteger(quantity))
    ) {
      throw new Error(quantityMode === 'decimal'
        ? 'Informe uma quantidade válida com até três casas decimais.'
        : 'Este produto aceita somente quantidades inteiras.');
    }

    const operation = beginInventoryOperation(
      familyId,
      cacheId,
      'move',
      { productId, type, quantity, note }
    );

    const result = await request(familyId, {
      action: 'move',
      productId,
      type,
      quantity,
      note,
      operationId: operation.operationId,
      expectedOwnerFamilyId: cacheId,
    });
    if (!result.product || !result.movement) {
      throw new Error('O servidor não confirmou a movimentação.');
    }
    const current = readCache(cacheId);

    const beforeProduct = cache.products.find(item => item.id === productId);
    const currentProduct = current.products.find(item => item.id === productId);

    if (
      JSON.stringify(beforeProduct) !== JSON.stringify(currentProduct) ||
      current.pendingIds.includes(productId) ||
      current.deletedIds.includes(productId) ||
      current.conflictIds.includes(productId)
    ) {
      throw new Error(
        'A movimentação foi confirmada pelo servidor, mas o produto ' +
        'mudou localmente. Não repita a movimentação. ' +
        'Atualize o Estoque para reconciliar os dados.'
      );
    }

    const updated: InventoryCache = {
      ...current,
      products: [
        result.product,
        ...current.products.filter(item => item.id !== productId),
      ],
      movements: [
        result.movement,
        ...current.movements.filter(item => item.id !== result.movement.id),
      ],
    };

    writeCache(cacheId, updated);
    clearPendingOperation(familyId, operation.operationId);
    return result;
  },
};
