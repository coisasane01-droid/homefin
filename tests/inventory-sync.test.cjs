const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

const source = fs.readFileSync(
  path.join(process.cwd(), 'services/inventory.ts'),
  'utf8'
);

function createEnvironment() {
  const storage = new Map();

  const localStorage = {
    getItem: key => storage.has(key) ? storage.get(key) : null,
    setItem: (key, value) => storage.set(key, String(value)),
    removeItem: key => storage.delete(key),
  };

  const context = {
    localStorage,
    navigator: { onLine: true },
    crypto: require('node:crypto').webcrypto,
    console,
    Date,
    JSON,
    Map,
    Set,
    Number,
    Math,
    Error,
    Promise,
    fetch: null,
  };

  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
    },
  }).outputText;

  const module = { exports: {} };
  context.module = module;
  context.exports = module.exports;

  vm.runInNewContext(compiled, context);

  return {
    service: module.exports.inventoryService,
    storage,
    localStorage,
    setFetch: fn => { context.fetch = fn; },
  };
}

const familyId = 'family-one';
const cacheKey = 'homefin_inventory_family-one';

const product = {
  id: '00000000-0000-4000-8000-000000000001',
  name: 'Produto original',
  sku: 'TESTE',
  category: '',
  supplier: '',
  quantity: 10,
  minimumQuantity: 0,
  quantityMode: 'integer',
  costPrice: 5,
  salePrice: 10,
  wholesalePrice: 8,
  updatedAt: '2026-11-16T10:00:00.000Z',
};

function makeCache(overrides = {}) {
  return {
    products: [product],
    movements: [],
    pendingIds: [product.id],
    deletedIds: [],
    conflictIds: [],
    conflictProducts: [],
    ...overrides,
  };
}

function setupSession(env) {
  env.localStorage.setItem(
    'homefin_family_session_token_family-one',
    'test-token'
  );
  env.localStorage.setItem(
    'homefin_family_session_expires_at_family-one',
    String(Date.now() + 3600000)
  );
}

function jsonResponse(body) {
  return {
    ok: true,
    status: 200,
    json: async () => body,
  };
}

test('preserva mudança local durante sincronização de produto', async () => {
  const env = createEnvironment();
  setupSession(env);

  env.localStorage.setItem(cacheKey, JSON.stringify(makeCache()));

  let releaseSave;
  let notifySave;

  const saveStarted = new Promise(resolve => {
    notifySave = resolve;
  });

  const saveGate = new Promise(resolve => {
    releaseSave = resolve;
  });

  env.setFetch(async (_url, options) => {
    const body = JSON.parse(options.body);

    if (body.action === 'list') {
      return jsonResponse({
        ownerFamilyId: familyId,
        products: [product],
        movements: [],
      });
    }

    if (body.action === 'save') {
      notifySave();
      await saveGate;

      return jsonResponse({
        product: {
          ...product,
          updatedAt: '2026-11-16T11:00:00.000Z',
        },
      });
    }

    throw new Error('Ação inesperada: ' + body.action);
  });

  const operation = env.service.load(familyId);

  await saveStarted;

  const latest = JSON.parse(env.localStorage.getItem(cacheKey));
  latest.products.push({
    ...product,
    id: '00000000-0000-4000-8000-000000000002',
    name: 'Produto criado durante a sincronização',
  });

  env.localStorage.setItem(cacheKey, JSON.stringify(latest));

  releaseSave();

  const result = await operation;
  const finalCache = JSON.parse(env.localStorage.getItem(cacheKey));

  assert.equal(result.synced, false);
  assert.equal(finalCache.products.length, 2);
  assert.ok(finalCache.pendingIds.includes(product.id));
});

test('preserva cache alterado durante exclusão remota', async () => {
  const env = createEnvironment();
  setupSession(env);

  env.localStorage.setItem(
    cacheKey,
    JSON.stringify(makeCache({
      products: [],
      pendingIds: [],
      deletedIds: [product.id],
    }))
  );

  let releaseDelete;
  let notifyDelete;

  const deleteStarted = new Promise(resolve => {
    notifyDelete = resolve;
  });

  const deleteGate = new Promise(resolve => {
    releaseDelete = resolve;
  });

  env.setFetch(async (_url, options) => {
    const body = JSON.parse(options.body);

    if (body.action === 'list') {
      return jsonResponse({
        ownerFamilyId: familyId,
        products: [],
        movements: [],
      });
    }

    if (body.action === 'delete') {
      notifyDelete();
      await deleteGate;
      return jsonResponse({});
    }

    throw new Error('Ação inesperada: ' + body.action);
  });

  const operation = env.service.load(familyId);

  await deleteStarted;

  const latest = JSON.parse(env.localStorage.getItem(cacheKey));
  latest.pendingIds.push(
    '00000000-0000-4000-8000-000000000003'
  );

  env.localStorage.setItem(cacheKey, JSON.stringify(latest));

  releaseDelete();

  const result = await operation;
  const finalCache = JSON.parse(env.localStorage.getItem(cacheKey));

  assert.equal(result.synced, false);
  assert.equal(finalCache.pendingIds.length, 1);
  assert.ok(finalCache.deletedIds.includes(product.id));
});

test('não interpreta cache corrompido como estoque vazio', async () => {
  const env = createEnvironment();

  env.localStorage.setItem(cacheKey, '{json-invalido');

  await assert.rejects(
    () => env.service.load(familyId),
    /Não foi possível ler os dados locais/
  );

  assert.equal(
    env.localStorage.getItem(cacheKey),
    '{json-invalido'
  );
});

test('movimentação individual não sobrescreve alteração local simultânea', async () => {
  const env = createEnvironment();
  setupSession(env);

  env.localStorage.setItem(
    cacheKey,
    JSON.stringify(makeCache({ pendingIds: [] }))
  );

  let releaseMove;
  let notifyMove;

  const started = new Promise(resolve => {
    notifyMove = resolve;
  });

  const gate = new Promise(resolve => {
    releaseMove = resolve;
  });

  env.setFetch(async (_url, options) => {
    const body = JSON.parse(options.body);

    if (body.action === 'list') {
      return jsonResponse({
        ownerFamilyId: familyId,
        products: [product],
        movements: [],
      });
    }

    if (body.action === 'move') {
      notifyMove();
      await gate;

      return jsonResponse({
        product: { ...product, quantity: 9 },
        movement: {
          id: 'movement-one',
          productId: product.id,
          type: 'exit',
          quantity: 1,
          note: '',
          createdAt: new Date().toISOString(),
        },
      });
    }

    throw new Error('Ação inesperada: ' + body.action);
  });

  const operation = env.service.move(
    familyId,
    product.id,
    'exit',
    1,
    ''
  );

  await started;

  const latest = JSON.parse(env.localStorage.getItem(cacheKey));
  latest.pendingIds.push('another-product');

  env.localStorage.setItem(cacheKey, JSON.stringify(latest));

  releaseMove();
  await operation;

  const finalCache = JSON.parse(env.localStorage.getItem(cacheKey));

  assert.ok(
    finalCache.pendingIds.includes('another-product'),
    'A movimentação não pode apagar uma pendência recente.'
  );
});

test('baixa em lote não sobrescreve alteração local simultânea', async () => {
  const env = createEnvironment();
  setupSession(env);

  env.localStorage.setItem(
    cacheKey,
    JSON.stringify(makeCache({ pendingIds: [] }))
  );

  let releaseBatch;
  let notifyBatch;

  const started = new Promise(resolve => {
    notifyBatch = resolve;
  });

  const gate = new Promise(resolve => {
    releaseBatch = resolve;
  });

  env.setFetch(async (_url, options) => {
    const body = JSON.parse(options.body);

    if (body.action === 'list') {
      return jsonResponse({
        ownerFamilyId: familyId,
        products: [product],
        movements: [],
      });
    }

    if (body.action === 'move-batch') {
      notifyBatch();
      await gate;

      return jsonResponse({
        products: [{ ...product, quantity: 8 }],
        movements: [{
          id: 'movement-batch',
          productId: product.id,
          type: 'exit',
          quantity: 2,
          note: '',
          createdAt: new Date().toISOString(),
        }],
      });
    }

    throw new Error('Ação inesperada: ' + body.action);
  });

  const operation = env.service.moveBatch(
    familyId,
    [{ productId: product.id, quantity: 2 }],
    ''
  );

  await started;

  const latest = JSON.parse(env.localStorage.getItem(cacheKey));
  latest.pendingIds.push('another-product');

  env.localStorage.setItem(cacheKey, JSON.stringify(latest));

  releaseBatch();
  await operation;

  const finalCache = JSON.parse(env.localStorage.getItem(cacheKey));

  assert.ok(
    finalCache.pendingIds.includes('another-product'),
    'A baixa em lote não pode apagar uma pendência recente.'
  );
});
