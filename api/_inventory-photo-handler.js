import { validateFamilySession } from './_family-session.js';
import { signFamilyObject, removeStorageObjects } from './_family-storage.js';
import { isInventoryPhotoPath } from './_inventory-photo-path.js';
import { uploadInventoryPhoto } from './_inventory-photo-upload.js';

const FAMILY_PATTERN = /^[a-z0-9][a-z0-9-]{0,99}$/;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

async function databaseRequest(path, options = {}) {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Supabase não configurado.');

  const response = await fetch(
    `${url.replace(/\/+$/, '')}/rest/v1/${path}`,
    {
      ...options,
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
        ...(options.headers || {}),
      },
      cache: 'no-store',
    }
  );

  if (!response.ok) {
    throw new Error(`Supabase HTTP ${response.status}`);
  }

  const body = await response.text();
  return body ? JSON.parse(body) : null;
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Método não permitido.' });
  }

  const { action = 'view', familyId, productId } = req.body || {};

  if (
    typeof familyId !== 'string' ||
    !FAMILY_PATTERN.test(familyId) ||
    familyId === 'v1' ||
    typeof productId !== 'string' ||
    !UUID_PATTERN.test(productId)
  ) {
    return res.status(400).json({ error: 'Dados inválidos.' });
  }

  if (!['view', 'upload', 'remove'].includes(action)) {
    return res.status(400).json({ error: 'Operação inválida.' });
  }

  try {
    const session = await validateFamilySession(req, familyId);
    if (!session.valid) {
      return res.status(401).json({
        error: session.error || 'Sessão inválida.',
      });
    }

    const shares = await databaseRequest(
      `homefin_inventory_shares?shared_family_id=eq.${encodeURIComponent(familyId)}&select=owner_family_id&limit=1`
    );

    const ownerFamilyId = shares?.[0]?.owner_family_id || familyId;

    if (action !== 'view' &&
        req.body.expectedOwnerFamilyId !== ownerFamilyId) {
      return res.status(409).json({
        error: 'O compartilhamento mudou. Atualize o Estoque.',
      });
    }

    const products = await databaseRequest(
      `homefin_inventory_products?family_id=eq.${encodeURIComponent(ownerFamilyId)}&id=eq.${encodeURIComponent(productId)}&select=id,photo_storage_path&limit=1`
    );

    const product = products?.[0];

    if (!product) {
      return res.status(404).json({
        error: 'Produto não encontrado neste estoque.',
      });
    }

    const oldPath = product.photo_storage_path || '';

    if (oldPath &&
        !isInventoryPhotoPath(oldPath, ownerFamilyId, productId)) {
      return res.status(403).json({
        error: 'Referência de foto inválida.',
      });
    }

    if (action === 'view') {
      if (!oldPath) {
        return res.status(200).json({ photoUrl: null });
      }

      const photoUrl = await signFamilyObject(oldPath, 300);
      return res.status(200).json({ photoUrl, expiresIn: 300 });
    }

    let newPath = '';

    if (action === 'upload') {
      const uploaded = await uploadInventoryPhoto({
        ownerFamilyId,
        productId,
        imageBase64: req.body.imageBase64,
      });
      newPath = uploaded.path;
    }

    try {
      await databaseRequest('rpc/homefin_inventory_set_photo_authorized', {
        method: 'POST',
        body: JSON.stringify({
          p_actor_family_id: familyId,
          p_owner_family_id: ownerFamilyId,
          p_product_id: productId,
          p_photo_storage_path: newPath,
        }),
      });
    } catch (error) {
      if (newPath) {
        try {
          await removeStorageObjects([newPath]);
        } catch (cleanupError) {
          console.error('Falha ao limpar upload não vinculado:', cleanupError);
        }
      }
      throw error;
    }

    // A foto anterior não é excluída automaticamente:
    // preservamos o arquivo para evitar perda em operações concorrentes.
    const photoUrl = newPath
      ? await signFamilyObject(newPath, 300)
      : null;

    return res.status(200).json({
      success: true,
      photoUrl,
      expiresIn: newPath ? 300 : 0,
    });
  } catch (error) {
    console.error(
      'Falha na operação de foto do estoque:',
      error instanceof Error ? error.message : 'Erro desconhecido'
    );
    return res.status(503).json({
      error: 'Não foi possível concluir a operação de foto.',
    });
  }
}
