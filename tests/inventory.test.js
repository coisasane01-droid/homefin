import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import inventoryHandler from '../api/inventory.js';
import { createFamilySessionToken } from '../api/_family-session.js';

process.env.HOMEFIN_SESSION_SECRET =
  'test-secret-with-more-than-thirty-two-characters';
process.env.VITE_SUPABASE_URL = 'https://supabase.example.test';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key';

const originalFetch = global.fetch;
const productId = '00000000-0000-4000-8000-000000000001';

afterEach(() => {
  global.fetch = originalFetch;
});

function responseCapture() {
  return {
    statusCode: 200,
    setHeader() { return this; },
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
}

function setupFetch(owner = 'family-one', shared = false) {
  const calls = [];

  global.fetch = async (input, options = {}) => {
    const url = new URL(input);
    const path = url.pathname;
    const body = options.body ? JSON.parse(options.body) : null;

    if (path.endsWith('/homefin_family_credentials')) {
      return Response.json([{ session_version: 1 }]);
    }

    if (path.endsWith('/homefin_inventory_shares')) {
      return Response.json(shared
        ? [{ owner_family_id: owner }]
        : []);
    }

    if (path.includes('/rpc/')) {
      calls.push({ path, body });

      if (path.endsWith('/rpc/homefin_inventory_move_batch_authorized')) {
        const items = body.p_items || [];

        return Response.json({
          products: items.map(item => ({
            id: item.product_id,
            name: 'Produto de teste',
            quantity: 10,
            quantity_mode: 'decimal',
          })),
          movements: items.map((item, index) => ({
            id: `00000000-0000-4000-8000-${String(index + 100).padStart(12, '0')}`,
            product_id: item.product_id,
            type: 'exit',
            quantity: item.quantity,
          })),
        });
      }

      return Response.json({
        product: {},
        movement: {},
        products: [],
        movements: [],
      });
    }

    throw new Error(`Requisição inesperada: ${path}`);
  };

  return calls;
}

async function invoke(action, fields = {}, familyId = 'family-one') {
  const response = responseCapture();

  await inventoryHandler({
    method: 'POST',
    headers: {
      authorization: `Bearer ${createFamilySessionToken(familyId)}`,
    },
    body: {
      action,
      familyId,
      expectedOwnerFamilyId: familyId,
      ...fields,
    },
  }, response);

  return response;
}

test('rejeita movimentações inválidas antes da RPC', async () => {
  const calls = setupFetch();

  for (const quantity of [0, -1, 0.0001, 1.2345, 100000001]) {
    const result = await invoke('move', {
      productId,
      type: 'exit',
      quantity,
      note: '',
    });

    assert.equal(result.statusCode, 400, `Quantidade ${quantity}`);
  }

  assert.equal(calls.length, 0);
});

test('aceita quantidades fracionadas com três casas', async () => {
  const calls = setupFetch();

  for (const quantity of [0.5, 1.25, 2.75]) {
    const result = await invoke('move', {
      productId,
      type: 'exit',
      quantity,
      note: '',
    });

    assert.equal(result.statusCode, 200);
  }

  assert.deepEqual(
    calls.map(call => call.body.p_quantity),
    [0.5, 1.25, 2.75]
  );
});

test('não permite movimentar sem sessão familiar', async () => {
  setupFetch();
  const response = responseCapture();

  await inventoryHandler({
    method: 'POST',
    headers: {},
    body: {
      action: 'move',
      familyId: 'family-one',
      expectedOwnerFamilyId: 'family-one',
      productId,
      type: 'exit',
      quantity: 1,
      note: '',
    },
  }, response);

  assert.equal(response.statusCode, 401);
});

test('bloqueia movimentação com proprietário divergente', async () => {
  const calls = setupFetch('family-owner', true);

  const result = await invoke('move', {
    productId,
    type: 'exit',
    quantity: 1,
    note: '',
  });

  assert.equal(result.statusCode, 409);
  assert.equal(calls.length, 0);
});

test('rejeita baixa em lote com quantidade inválida', async () => {
  const calls = setupFetch();

  const result = await invoke('move-batch', {
    items: [{ productId, quantity: 0.0001 }],
    note: '',
  });

  assert.equal(result.statusCode, 400);
  assert.equal(calls.length, 0);
});

test('encaminha baixa em lote com quantidades fracionadas', async () => {
  const calls = setupFetch();

  const items = [
    {
      productId: '00000000-0000-4000-8000-000000000001',
      quantity: 0.5,
    },
    {
      productId: '00000000-0000-4000-8000-000000000002',
      quantity: 2.75,
    },
  ];

  const result = await invoke('move-batch', {
    items,
    note: 'Teste de baixa múltipla',
  });

  assert.equal(result.statusCode, 200);

  const batchCall = calls.find(call =>
    call.path.endsWith('/rpc/homefin_inventory_move_batch_authorized')
  );

  assert.ok(batchCall, 'A RPC de baixa em lote deve ser chamada.');
  assert.deepEqual(
    batchCall.body.p_items,
    items.map(item => ({
      product_id: item.productId,
      quantity: item.quantity,
    }))
  );
});
