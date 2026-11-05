import {
  assertFamilyOwnsObject,
  authorizeStorageFamily,
  isFamilyObjectReferenced,
  normalizeStorageObjectPath,
  pruneFamilyStorageObjects,
  removeStorageObjects,
  signFamilyObject,
  uploadFamilyObject,
} from './_family-storage.js';

export const config = {
  api: { bodyParser: false },
};

const MAX_FILE_BYTES = 3 * 1024 * 1024;
const MAX_REQUEST_BYTES = Math.ceil(MAX_FILE_BYTES / 3) * 4 + 64 * 1024;
const ALLOWED_CONTENT_TYPES = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/heic',
  'image/heif',
]);

async function readJsonBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.length;
    if (size > MAX_REQUEST_BYTES) throw new Error('A requisição excede o limite permitido.');
    chunks.push(buffer);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    throw new Error('Corpo JSON inválido.');
  }
}

function decodeFile(body) {
  const { name, contentType, base64 } = body;
  if (
    typeof name !== 'string' || !name.trim() || name.length > 255 ||
    typeof contentType !== 'string' || !ALLOWED_CONTENT_TYPES.has(contentType.toLowerCase()) ||
    typeof base64 !== 'string' || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(base64)
  ) {
    throw new Error('Arquivo ou tipo de anexo inválido.');
  }
  const bytes = Buffer.from(base64, 'base64');
  if (bytes.length === 0 || bytes.length > MAX_FILE_BYTES || bytes.toString('base64') !== base64) {
    throw new Error('O anexo deve ter até 3 MB e não pode estar vazio.');
  }
  return { name, contentType: contentType.toLowerCase(), bytes };
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Método não permitido.' });
  }

  let body;
  try {
    body = await readJsonBody(req);
  } catch (error) {
    return res.status(400).json({ error: error instanceof Error ? error.message : 'Corpo inválido.' });
  }

  const identity = await authorizeStorageFamily(req, body?.familyId);
  if (!identity.valid) return res.status(identity.status).json({ error: identity.error });

  try {
    if (body.action === 'upload') {
      const file = decodeFile(body);
      const result = await uploadFamilyObject(
        identity.familyId,
        file.name,
        file.contentType,
        file.bytes
      );
      return res.status(200).json({ success: true, ...result });
    }

    if (body.action === 'prune') {
      const removed = await pruneFamilyStorageObjects(identity.familyId);
      return res.status(200).json({ success: true, removed });
    }

    if (body.action === 'sign' || body.action === 'delete') {
      const path = normalizeStorageObjectPath(body.path);
      if (!path) return res.status(400).json({ error: 'Caminho do anexo inválido.' });
      if (!await assertFamilyOwnsObject(identity.familyId, path)) {
        return res.status(404).json({ error: 'Anexo não encontrado para esta família.' });
      }

      if (body.action === 'sign') {
        const expiresIn = Number(body.expiresIn || 3600);
        if (!Number.isInteger(expiresIn) || expiresIn < 60 || expiresIn > 3600) {
          return res.status(400).json({ error: 'Validade da URL assinada inválida.' });
        }
        const url = await signFamilyObject(path, expiresIn);
        return res.status(200).json({ success: true, url });
      }

      if (await isFamilyObjectReferenced(identity.familyId, path)) {
        return res.status(409).json({
          error: 'Remova o anexo do registro financeiro e aguarde a sincronização antes de excluí-lo.',
        });
      }
      await removeStorageObjects([path]);
      return res.status(200).json({ success: true });
    }

    return res.status(400).json({ error: 'Operação de anexo inválida.' });
  } catch (error) {
    console.error('Erro na API de anexos:', error instanceof Error ? error.message : 'erro desconhecido');
    return res.status(502).json({ error: 'Não foi possível concluir a operação de anexo.' });
  }
}
