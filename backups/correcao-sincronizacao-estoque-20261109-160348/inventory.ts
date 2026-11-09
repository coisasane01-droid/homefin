import type { InventoryData, InventoryProduct, InventoryMovement, InventoryMovementType } from '../types/inventory';

const emptyData = (): InventoryData => ({ products: [], movements: [] });
const cacheKey = (familyId: string) => `homefin_inventory_${familyId}`;

function readCache(familyId: string): InventoryData {
  try {
    const raw = localStorage.getItem(cacheKey(familyId));
    if (!raw) return emptyData();
    const data = JSON.parse(raw);
    return {
      products: Array.isArray(data.products) ? data.products : [],
      movements: Array.isArray(data.movements) ? data.movements : [],
    };
  } catch {
    return emptyData();
  }
}

function writeCache(familyId: string, data: InventoryData) {
  localStorage.setItem(cacheKey(familyId), JSON.stringify(data));
}

async function request(familyId: string, body: Record<string, unknown>) {
  const token = localStorage.getItem(`homefin_family_session_token_${familyId}`);
  const expiry = Number(localStorage.getItem(`homefin_family_session_expires_at_${familyId}`) || 0);
  if (!token || !expiry || expiry <= Date.now()) throw new Error('Sessão familiar ausente ou expirada.');
  const response = await fetch('/api/inventory', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ ...body, familyId }),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error || 'Falha ao sincronizar o Estoque.');
  return result;
}

export const inventoryService = {
  async load(familyId: string): Promise<{ data: InventoryData; synced: boolean }> {
    const cached = readCache(familyId);
    try {
      const result = await request(familyId, { action: 'list' });
      const data: InventoryData = {
        products: result.products || [],
        movements: result.movements || [],
      };
      writeCache(familyId, data);
      return { data, synced: true };
    } catch {
      return { data: cached, synced: false };
    }
  },

  async saveProduct(familyId: string, product: InventoryProduct) {
    const data = readCache(familyId);
    const products = [...data.products.filter(p => p.id !== product.id), product];
    const next = { ...data, products };
    writeCache(familyId, next);
    try {
      await request(familyId, { action: 'save', product });
      return { synced: true };
    } catch {
      return { synced: false };
    }
  },

  async deleteProduct(familyId: string, id: string) {
    const data = readCache(familyId);
    const next = { ...data, products: data.products.filter(p => p.id !== id) };
    writeCache(familyId, next);
    try {
      await request(familyId, { action: 'delete', id });
      return { synced: true };
    } catch {
      return { synced: false };
    }
  },

  async move(familyId: string, productId: string, type: InventoryMovementType, quantity: number, note: string) {
    const result = await request(familyId, { action: 'move', productId, type, quantity, note });
    const data = readCache(familyId);
    if (result.product) {
      const products = [...data.products.filter(p => p.id !== result.product.id), result.product];
      const movements = [result.movement, ...data.movements].filter(Boolean);
      writeCache(familyId, { products, movements });
    }
    return result;
  },
};
