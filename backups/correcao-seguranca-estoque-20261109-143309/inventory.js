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

function productFromDb(row) {
  return {
    id: row.id, name: row.name, sku: row.sku || '', category: row.category || '',
    supplier: row.supplier || '', quantity: Number(row.quantity),
    minimumQuantity: Number(row.minimum_quantity),
    costPrice: Number(row.cost_price), salePrice: Number(row.sale_price),
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
  return p && UUID_PATTERN.test(String(p.id || '')) &&
    typeof p.name === 'string' && p.name.trim().length > 0 && p.name.length <= 160 &&
    typeof p.sku === 'string' && p.sku.length <= 80 &&
    typeof p.category === 'string' && p.category.length <= 100 &&
    typeof p.supplier === 'string' && p.supplier.length <= 160 &&
    Number.isInteger(p.quantity) && p.quantity >= 0 && p.quantity <= 100000000 &&
    Number.isInteger(p.minimumQuantity) && p.minimumQuantity >= 0 && p.minimumQuantity <= 100000000 &&
    Number.isFinite(p.costPrice) && p.costPrice >= 0 && p.costPrice <= 1000000000 &&
    Number.isFinite(p.salePrice) && p.salePrice >= 0 && p.salePrice <= 1000000000;
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
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
    if (!session.valid) return res.status(401).json({ error: session.error || 'Sessão inválida.' });

    if (action === 'list') {
      const [products, movements] = await Promise.all([
        db(`homefin_inventory_products?family_id=eq.${encodeURIComponent(familyId)}&select=*&order=name.asc`),
        db(`homefin_inventory_movements?family_id=eq.${encodeURIComponent(familyId)}&select=*&order=created_at.desc&limit=500`),
      ]);
      return res.status(200).json({
        products: products.map(productFromDb),
        movements: movements.map(movementFromDb),
      });
    }

    if (action === 'save') {
      const p = req.body.product;
      if (!validProduct(p)) return res.status(400).json({ error: 'Dados do produto inválidos.' });
      const values = {
        id: p.id, family_id: familyId, name: p.name.trim(), sku: p.sku.trim(),
        category: p.category.trim(), supplier: p.supplier.trim(),
        quantity: p.quantity, minimum_quantity: p.minimumQuantity,
        cost_price: p.costPrice, sale_price: p.salePrice, updated_at: new Date().toISOString(),
      };
      const rows = await db(`homefin_inventory_products?on_conflict=id`, {
        method: 'POST',
        headers: { Prefer: 'resolution=merge-duplicates,return=representation' },
        body: JSON.stringify(values),
      });
      return res.status(200).json({ product: productFromDb(rows[0]) });
    }

    if (action === 'delete') {
      if (!UUID_PATTERN.test(String(req.body.id || ''))) return res.status(400).json({ error: 'Produto inválido.' });
      await db(`homefin_inventory_products?family_id=eq.${encodeURIComponent(familyId)}&id=eq.${req.body.id}`, {
        method: 'DELETE', headers: { Prefer: 'return=minimal' },
      });
      return res.status(200).json({ success: true });
    }

    if (action === 'move') {
      const { productId, type, quantity, note = '' } = req.body;
      if (!UUID_PATTERN.test(String(productId || '')) ||
          !['entry', 'exit'].includes(type) ||
          !Number.isInteger(quantity) || quantity < 1 || quantity > 100000000 ||
          typeof note !== 'string' || note.length > 500) {
        return res.status(400).json({ error: 'Dados da movimentação inválidos.' });
      }
      const result = await db('rpc/homefin_inventory_move', {
        method: 'POST',
        body: JSON.stringify({
          p_family_id: familyId, p_product_id: productId,
          p_type: type, p_quantity: quantity, p_note: note,
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
    console.error('Erro no Estoque:', error?.message || 'erro desconhecido');
    return res.status(502).json({ error: error?.message || 'Falha ao acessar o Estoque.' });
  }
}
