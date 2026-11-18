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
    require: (id) => {
      if (id === './nativeApi') {
        return { homefinApiUrl: path => path };
      }
      if (id === './familyAuth') {
        return {
          getFamilySessionToken: async familyId =>
            localStorage.getItem(
              `homefin_family_session_token_${familyId}`
            ),
        };
      }
      throw new Error(`Módulo não simulado: ${id}`);
    },
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


function setupArchiveEnv() {
  const env = createEnvironment();
  setupSession(env);
  env.localStorage.setItem(cacheKey, JSON.stringify(makeCache({ pendingIds: [] })));
  return env;
}
function archiveFetch(env, handler) {
  env.setFetch(async (_url, options) => {
    const body = JSON.parse(options.body);
    if (body.action === 'list') return jsonResponse({ownerFamilyId: familyId, products: [product], movements: []});
    return handler(body);
  });
}

test('arquiva e restaura produto preservando saldo e versão enviada', async () => {
  const env = setupArchiveEnv();
  let count = 0;
  archiveFetch(env, body => {
    assert.equal(body.action, 'set-archived');
    assert.equal(body.expectedUpdatedAt, count === 0 ? product.updatedAt : '2026-11-16T11:00:00.000Z');
    assert.equal(body.archived, count === 0);
    count++;
    return jsonResponse({product: {...product, archivedAt: body.archived ? '2026-11-16T11:00:00.000Z' : null, updatedAt: '2026-11-16T11:00:00.000Z'}});
  });
  const archived = await env.service.setArchived(familyId, product, true);
  assert.equal(archived.quantity, 10);
  assert.ok(archived.archivedAt);
  const restored = await env.service.setArchived(familyId, archived, false);
  assert.equal(restored.archivedAt, null);
  assert.equal(count, 2);
});

test('arquivamento não sobrescreve cache modificado durante requisição', async () => {
  const env = setupArchiveEnv();
  let release, started;
  const startedPromise = new Promise(r => {started = r});
  const gate = new Promise(r => {release = r});
  archiveFetch(env, async body => {
    assert.equal(body.action, 'set-archived');
    started();
    await gate;
    return jsonResponse({product: {...product, archivedAt: '2026-11-16T11:00:00.000Z'}});
  });
  const task = env.service.setArchived(familyId, product, true);
  await startedPromise;
  const cache = JSON.parse(env.localStorage.getItem(cacheKey));
  cache.products[0].name = 'Alterado localmente';
  env.localStorage.setItem(cacheKey, JSON.stringify(cache));
  release();
  await assert.rejects(task, /alterações locais|Atualize o Estoque|conciliar/i);
  assert.equal(JSON.parse(env.localStorage.getItem(cacheKey)).products[0].name, 'Alterado localmente');
});

test('exclusão envia versão e preserva cache alterado durante requisição', async () => {
  const env = setupArchiveEnv();
  let release, started;
  const startedPromise = new Promise(r => {started = r});
  const gate = new Promise(r => {release = r});
  archiveFetch(env, async body => {
    assert.equal(body.action, 'delete');
    assert.equal(body.expectedUpdatedAt, product.updatedAt);
    started();
    await gate;
    return jsonResponse({success: true});
  });
  const task = env.service.deleteConfirmed(familyId, product);
  await startedPromise;
  const cache = JSON.parse(env.localStorage.getItem(cacheKey));
  cache.products.push({...product, id: '00000000-0000-4000-8000-000000000002'});
  env.localStorage.setItem(cacheKey, JSON.stringify(cache));
  release();
  await assert.rejects(task, /alterações locais|Atualize o Estoque|conciliar/i);
  assert.equal(JSON.parse(env.localStorage.getItem(cacheKey)).products.length, 2);
});
