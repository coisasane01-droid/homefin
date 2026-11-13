import { validateFamilySession } from './_family-session.js';

const FAMILY_ID_PATTERN = /^[a-z0-9][a-z0-9-]{0,99}$/;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

async function db(path, options = {}) {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Configuração segura do Supabase indisponível.');
  const response = await fetch(`${url.replace(/\/+$/, '')}/rest/v1/${path}`, {
    ...options,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'Accept-Profile': 'public',
      'Content-Profile': 'public',
      ...(options.headers || {}),
    },
    cache: 'no-store',
  });
  const body = await response.text();
  if (!response.ok) {
    let parsed = {};
    try { parsed = body ? JSON.parse(body) : {}; } catch {}
    const error = new Error(parsed.message || 'Falha ao acessar o Estoque no Supabase.');
    error.code = parsed.code;
    throw error;
  }
  return body ? JSON.parse(body) : null;
}

function validStockQuantity(value, allowZero = false) {
  return typeof value === 'number' &&
    Number.isFinite(value) &&
    (allowZero ? value >= 0 : value > 0) &&
    value <= 100000000 &&
    Math.abs(value * 1000 - Math.round(value * 1000)) < 1e-7;
}

function productFromDb(row) {
  return {
    id: row.id, name: row.name, sku: row.sku || '', category: row.category || '',
    supplier: row.supplier || '', quantity: Number(row.quantity),
    minimumQuantity: Number(row.minimum_quantity),
    costPrice: Number(row.cost_price), salePrice: Number(row.sale_price),
    wholesalePrice: Number(row.wholesale_price ?? 0),
    quantityMode: row.quantity_mode === 'decimal' ? 'decimal' : 'integer',
    updatedAt: row.updated_at,
  };
}

function movementFromDb(row) {
  return {
    id: row.id, productId: row.product_id, type: row.movement_type,
    quantity: Number(row.quantity), note: row.note || '', createdAt: row.created_at,
  };
}

function validProduct(p) {
  const quantityMode = p?.quantityMode || 'integer';
  return p && UUID_PATTERN.test(String(p.id || '')) &&
    typeof p.name === 'string' && p.name.trim().length > 0 && p.name.length <= 160 &&
    typeof p.sku === 'string' && p.sku.length <= 80 &&
    typeof p.category === 'string' && p.category.length <= 100 &&
    typeof p.supplier === 'string' && p.supplier.length <= 160 &&
    ['integer', 'decimal'].includes(quantityMode) &&
    validStockQuantity(p.quantity, true) &&
    validStockQuantity(p.minimumQuantity, true) &&
    (quantityMode === 'decimal' ||
      (Number.isInteger(p.quantity) && Number.isInteger(p.minimumQuantity))) &&
    Number.isFinite(p.costPrice) && p.costPrice >= 0 && p.costPrice <= 1000000000 &&
    Number.isFinite(p.salePrice) && p.salePrice >= 0 && p.salePrice <= 1000000000 &&
    Number.isFinite(Number(p.wholesalePrice ?? 0)) &&
    Number(p.wholesalePrice ?? 0) >= 0 &&
    Number(p.wholesalePrice ?? 0) <= 1000000000;
}

async function resolveInventoryAccess(familyId) {
  const rows = await db(
    `homefin_inventory_shares?shared_family_id=eq.${encodeURIComponent(familyId)}&select=owner_family_id&limit=1`
  );
  const ownerFamilyId = rows?.[0]?.owner_family_id || familyId;
  const isOwner = ownerFamilyId === familyId;
  return { ownerFamilyId, isOwner };
}

async function requireOwner(familyId) {
  const access = await resolveInventoryAccess(familyId);
  if (!access.isOwner) {
    const error = new Error('Somente a família proprietária pode gerenciar os convites.');
    error.statusCode = 403;
    throw error;
  }
  return access;
}

async function listSharedFamilies(ownerFamilyId) {
  return db(
    `homefin_inventory_shares?owner_family_id=eq.${encodeURIComponent(ownerFamilyId)}&select=shared_family_id,created_at&order=created_at.asc`
  );
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Método não permitido.' });
  }

  const { action, familyId } = req.body || {};
  if (typeof familyId !== 'string' || !FAMILY_ID_PATTERN.test(familyId)) {
    return res.status(400).json({ error: 'Identificador familiar inválido.' });
  }

  try {
    const session = await validateFamilySession(req, familyId);
    if (!session.valid) {
      return res.status(401).json({ error: session.error || 'Sessão inválida.' });
    }

    if (action === 'share-list') {
      const access = await resolveInventoryAccess(familyId);
      const sharedFamilies = access.isOwner
        ? await listSharedFamilies(familyId)
        : [];
      return res.status(200).json({
        ownerFamilyId: access.ownerFamilyId,
        isOwner: access.isOwner,
        sharedFamilies: sharedFamilies.map(row => ({
          familyId: row.shared_family_id,
          createdAt: row.created_at,
        })),
      });
    }

    if (action === 'share-add') {
      await requireOwner(familyId);
      const target = String(req.body.targetFamilyId || '').trim().toLowerCase();

      if (!FAMILY_ID_PATTERN.test(target) || target === familyId) {
        return res.status(400).json({ error: 'Informe um ID válido de outra família.' });
      }

      // Só famílias cadastradas e com credencial ativa podem receber convite.
      const credentials = await db(
        `homefin_family_credentials?family_id=eq.${encodeURIComponent(target)}&select=family_id&limit=1`
      );
      if (!credentials.length) {
        return res.status(404).json({ error: 'Família não encontrada ou ainda sem cadastro de acesso.' });
      }

      // Uma família convidada não pode compartilhar nem receber outro convite.
      const targetAsGuest = await db(
        `homefin_inventory_shares?shared_family_id=eq.${encodeURIComponent(target)}&select=shared_family_id&limit=1`
      );
      const targetAsOwner = await db(
        `homefin_inventory_shares?owner_family_id=eq.${encodeURIComponent(target)}&select=shared_family_id&limit=1`
      );
      if (targetAsGuest.length || targetAsOwner.length) {
        return res.status(409).json({
          error: 'Essa família já participa de um compartilhamento. Não é permitido compartilhar em cadeia.',
        });
      }

      const inserted = await db('homefin_inventory_shares?select=shared_family_id,owner_family_id,created_at', {
        method: 'POST',
        headers: { Prefer: 'return=representation' },
        body: JSON.stringify({
          shared_family_id: target,
          owner_family_id: familyId,
        }),
      });
      if (!inserted?.length) {
        return res.status(502).json({ error: 'O Supabase não confirmou o convite.' });
      }
      return res.status(200).json({ success: true, familyId: target });
    }

    if (action === 'share-remove') {
      await requireOwner(familyId);
      const target = String(req.body.targetFamilyId || '').trim().toLowerCase();
      if (!FAMILY_ID_PATTERN.test(target)) {
        return res.status(400).json({ error: 'Identificador da família convidada inválido.' });
      }
      await db(
        `homefin_inventory_shares?owner_family_id=eq.${encodeURIComponent(familyId)}&shared_family_id=eq.${encodeURIComponent(target)}`,
        { method: 'DELETE', headers: { Prefer: 'return=minimal' } }
      );
      return res.status(200).json({ success: true });
    }

    const access = await resolveInventoryAccess(familyId);
    const inventoryFamilyId = access.ownerFamilyId;

    if (
      ['save', 'delete', 'move', 'move-batch'].includes(action) &&
      (
        typeof req.body.expectedOwnerFamilyId !== 'string' ||
        req.body.expectedOwnerFamilyId !== inventoryFamilyId
      )
    ) {
      return res.status(409).json({
        error: 'O compartilhamento do Estoque mudou. Atualize a tela antes de alterar os dados.',
      });
    }

    if (action === 'list') {
      const [inventory, sharedFamilies] = await Promise.all([
        db('rpc/homefin_inventory_list_authorized', {
          method: 'POST',
          body: JSON.stringify({
            p_actor_family_id: familyId,
            p_owner_family_id: inventoryFamilyId,
          }),
        }),
        access.isOwner ? listSharedFamilies(inventoryFamilyId) : Promise.resolve([]),
      ]);

      return res.status(200).json({
        products: (inventory?.products || []).map(productFromDb),
        movements: (inventory?.movements || []).map(movementFromDb),
        ownerFamilyId: inventoryFamilyId,
        isOwner: access.isOwner,
        sharedFamilies: sharedFamilies.map(row => ({
          familyId: row.shared_family_id,
          createdAt: row.created_at,
        })),
      });
    }

    if (action === 'save') {
      const p = req.body.product;
      if (!validProduct(p)) return res.status(400).json({ error: 'Dados do produto inválidos.' });

      const product = await db('rpc/homefin_inventory_save_authorized', {
        method: 'POST',
        body: JSON.stringify({
          p_actor_family_id: familyId,
          p_owner_family_id: inventoryFamilyId,
          p_product: {
            id: p.id,
            name: p.name.trim(),
            sku: p.sku.trim(),
            category: p.category.trim(),
            supplier: p.supplier.trim(),
            quantity: p.quantity,
            minimum_quantity: p.minimumQuantity,
            cost_price: p.costPrice,
            sale_price: p.salePrice,
            wholesale_price: Number(p.wholesalePrice ?? 0),
            quantity_mode: p.quantityMode || 'integer',
          },
        }),
      });

      if (!product) {
        return res.status(502).json({ error: 'O Supabase não confirmou o salvamento do produto.' });
      }
      return res.status(200).json({ product: productFromDb(product) });
    }

    if (action === 'delete') {
      if (!UUID_PATTERN.test(String(req.body.id || ''))) {
        return res.status(400).json({ error: 'Produto inválido.' });
      }

      const deleted = await db('rpc/homefin_inventory_delete_authorized', {
        method: 'POST',
        body: JSON.stringify({
          p_actor_family_id: familyId,
          p_owner_family_id: inventoryFamilyId,
          p_product_id: req.body.id,
        }),
      });

      if (!deleted) {
        return res.status(404).json({ error: 'Produto não encontrado neste Estoque.' });
      }
      return res.status(200).json({ success: true });
    }

      if (action === 'move-batch') {
        const { items, note = '' } = req.body;

        if (
          !Array.isArray(items) ||
          items.length < 1 ||
          items.length > 100 ||
          typeof note !== 'string' ||
          note.length > 500
        ) {
          return res.status(400).json({ error: 'Dados da baixa em lote inválidos.' });
        }

        const seen = new Set();
        const validItems = [];

        for (const item of items) {
          const productId = String(item?.productId || '');
          const quantity = item?.quantity;

          if (
            !UUID_PATTERN.test(productId) ||
            seen.has(productId) ||
            !validStockQuantity(quantity)
          ) {
            return res.status(400).json({
              error: 'Há produto repetido ou quantidade inválida na lista.',
            });
          }

          seen.add(productId);
          validItems.push({ product_id: productId, quantity });
        }

        const result = await db('rpc/homefin_inventory_move_batch_authorized', {
          method: 'POST',
          body: JSON.stringify({
            p_actor_family_id: familyId,
            p_owner_family_id: inventoryFamilyId,
            p_items: validItems,
            p_note: note,
          }),
        });

        if (
          !result ||
          !Array.isArray(result.products) ||
          !Array.isArray(result.movements) ||
          result.products.length !== validItems.length ||
          result.movements.length !== validItems.length
        ) {
          return res.status(502).json({
            error: 'O Supabase não confirmou todos os itens da baixa.',
          });
        }

        const returnedProducts = result.products.map(productFromDb);
        const returnedMovements = result.movements.map(movementFromDb);

        if (
          returnedProducts.some(product => !seen.has(product.id)) ||
          returnedMovements.some(movement => !seen.has(movement.productId)) ||
          new Set(returnedProducts.map(product => product.id)).size !== validItems.length ||
          new Set(returnedMovements.map(movement => movement.productId)).size !== validItems.length
        ) {
          return res.status(502).json({
            error: 'A confirmação do Supabase retornou itens diferentes da lista enviada.',
          });
        }

        return res.status(200).json({
          products: returnedProducts,
          movements: returnedMovements,
        });
      }

    if (action === 'move') {
      const { productId, type, quantity, note = '' } = req.body;
      if (!UUID_PATTERN.test(String(productId || '')) ||
          !['entry', 'exit'].includes(type) ||
          !validStockQuantity(quantity) ||
          typeof note !== 'string' || note.length > 500) {
        return res.status(400).json({ error: 'Dados da movimentação inválidos.' });
      }
      const result = await db('rpc/homefin_inventory_move_authorized', {
        method: 'POST',
        body: JSON.stringify({
          p_actor_family_id: familyId,
          p_owner_family_id: inventoryFamilyId,
          p_product_id: productId,
          p_type: type,
          p_quantity: quantity,
          p_note: note,
        }),
      });
      if (!result || !result.product || !result.movement) {
        return res.status(502).json({ error: 'O Supabase não confirmou a movimentação.' });
      }
      return res.status(200).json({
        product: productFromDb(result.product),
        movement: movementFromDb(result.movement),
      });
    }

    return res.status(400).json({ error: 'Operação de Estoque inválida.' });
  } catch (error) {
    const status = Number.isInteger(error?.statusCode)
      ? error.statusCode
      : ['42501', 'P0001', '23505'].includes(error?.code) ? 409 : 502;
    console.error('Erro no Estoque:', error?.message || 'erro desconhecido');
    return res.status(status).json({
      error: error?.message || 'Falha ao acessar o Estoque.',
    });
  }
}
