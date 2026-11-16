import { randomUUID } from 'node:crypto';
import { inventoryPhotoPath } from './_inventory-photo-path.js';

const MAX_IMAGE_BYTES = 2 * 1024 * 1024;

function detectImage(bytes) {
  if (
    bytes.length >= 3 &&
    bytes[0] === 0xff &&
    bytes[1] === 0xd8 &&
    bytes[2] === 0xff
  ) {
    return { extension: 'jpg', contentType: 'image/jpeg' };
  }

  if (
    bytes.length >= 8 &&
    bytes.subarray(0, 8).equals(
      Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
    )
  ) {
    return { extension: 'png', contentType: 'image/png' };
  }

  if (
    bytes.length >= 12 &&
    bytes.toString('ascii', 0, 4) === 'RIFF' &&
    bytes.toString('ascii', 8, 12) === 'WEBP'
  ) {
    return { extension: 'webp', contentType: 'image/webp' };
  }

  throw new Error('Formato de imagem não permitido.');
}

export async function uploadInventoryPhoto({
  ownerFamilyId,
  productId,
  imageBase64,
}) {
  if (
    typeof imageBase64 !== 'string' ||
    imageBase64.length > 3_000_000 ||
    !/^[A-Za-z0-9+/]+={0,2}$/.test(imageBase64) ||
    imageBase64.length % 4 !== 0
  ) {
    throw new Error('Imagem inválida ou muito grande.');
  }

  const bytes = Buffer.from(imageBase64, 'base64');

  if (!bytes.length || bytes.length > MAX_IMAGE_BYTES) {
    throw new Error('A foto deve ter no máximo 2 MB.');
  }

  const image = detectImage(bytes);

  const path = inventoryPhotoPath(
    ownerFamilyId,
    productId,
    randomUUID(),
    image.extension
  );

  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error('Supabase não configurado no servidor.');
  }

  const encodedPath = path
    .split('/')
    .map(encodeURIComponent)
    .join('/');

  const response = await fetch(
    `${url.replace(/\/+$/, '')}/storage/v1/object/attachments/${encodedPath}`,
    {
      method: 'POST',
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        'Content-Type': image.contentType,
        'x-upsert': 'false',
      },
      body: bytes,
      cache: 'no-store',
    }
  );

  if (!response.ok) {
    throw new Error(
      `Falha ao enviar foto ao Supabase Storage: HTTP ${response.status}`
    );
  }

  return {
    path,
    contentType: image.contentType,
    size: bytes.length,
  };
}
