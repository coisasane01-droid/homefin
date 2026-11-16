const FAMILY_PATTERN = /^[a-z0-9][a-z0-9-]{0,99}$/;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function inventoryPhotoPath(ownerFamilyId, productId, photoId, extension) {
  if (!FAMILY_PATTERN.test(ownerFamilyId)) {
    throw new Error('Família proprietária inválida.');
  }

  if (!UUID_PATTERN.test(productId) || !UUID_PATTERN.test(photoId)) {
    throw new Error('Identificador de foto ou produto inválido.');
  }

  if (!['jpg', 'jpeg', 'png', 'webp'].includes(extension)) {
    throw new Error('Formato de imagem inválido.');
  }

  return `inventory/${ownerFamilyId}/${productId}/${photoId}.${extension}`;
}

export function isInventoryPhotoPath(path, ownerFamilyId, productId) {
  if (
    typeof path !== 'string' ||
    !FAMILY_PATTERN.test(ownerFamilyId) ||
    !UUID_PATTERN.test(productId)
  ) {
    return false;
  }

  const prefix = `inventory/${ownerFamilyId}/${productId}/`;

  if (!path.startsWith(prefix)) return false;

  const filename = path.slice(prefix.length);

  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(jpg|jpeg|png|webp)$/i.test(filename);
}
