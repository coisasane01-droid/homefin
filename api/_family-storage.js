import { randomUUID } from 'node:crypto';
import { validateFamilySession } from './_family-session.js';

const FAMILY_ID_PATTERN = /^[a-z0-9][a-z0-9-]{0,99}$/;
const STORAGE_BUCKET = 'attachments';

function config() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Configuração server-side do Supabase ausente.');
  return { url: url.replace(/\/+$/, ''), key };
}

async function databaseRequest(path, options = {}) {
  const { url, key } = config();
  const response = await fetch(`${url}/rest/v1/${path}`, {
    ...options,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...(options.headers || {}),
    },
    cache: 'no-store',
  });
  const text = await response.text();
  if (!response.ok) {
    console.error('Falha ao gerenciar limpeza de anexos:', response.status);
    throw new Error(`Supabase database HTTP ${response.status}`);
  }
  if (!text) return null;
  return JSON.parse(text);
}

function encodedPath(path) {
  return path.split('/').map(encodeURIComponent).join('/');
}

async function storageRequest(path, options = {}) {
  const { url, key } = config();
  const response = await fetch(`${url}/storage/v1/${path}`, {
    ...options,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      ...(options.body instanceof Uint8Array
        ? { 'Content-Type': 'application/octet-stream' }
        : { 'Content-Type': 'application/json' }),
      ...(options.headers || {}),
    },
    cache: 'no-store',
  });
  const text = await response.text();
  if (!response.ok) {
    console.error('Falha ao acessar anexos no Supabase Storage:', response.status);
    throw new Error(`Supabase Storage HTTP ${response.status}`);
  }
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

export async function authorizeStorageFamily(req, familyId) {
  if (typeof familyId !== 'string' || !FAMILY_ID_PATTERN.test(familyId) || familyId === 'v1') {
    return { valid: false, status: 400, error: 'Identificador familiar inválido.' };
  }
  let session;
  try {
    session = await validateFamilySession(req, familyId);
  } catch (error) {
    console.error('Falha ao validar sessão para anexos:', error instanceof Error ? error.message : 'erro desconhecido');
    return { valid: false, status: 503, error: 'Não foi possível validar a sessão familiar.' };
  }
  if (!session.valid) {
    return { valid: false, status: 401, error: session.error || 'Sessão inválida.' };
  }
  return { valid: true, familyId: session.familyId };
}

export function normalizeStorageObjectPath(value) {
  if (typeof value !== 'string' || !value || value.length > 1024) return null;
  let path = value;
  if (/^https?:\/\//i.test(path)) {
    try {
      const url = new URL(path);
      const match = url.pathname.match(/\/storage\/v1\/object\/(?:sign|public|authenticated)\/attachments\/(.+)$/);
      if (!match) return null;
      path = match[1].split('/').map((part) => decodeURIComponent(part)).join('/');
    } catch {
      return null;
    }
  }
  if (
    path.startsWith('/') ||
    path.includes('\\') ||
    path.split('/').some((part) => !part || part === '.' || part === '..') ||
    path.includes('\0')
  ) return null;
  return path;
}

function referencedPaths(value, output = new Set(), property = '') {
  if (typeof value === 'string') {
    const isStorageUrl = /^https?:\/\//i.test(value) &&
      /\/storage\/v1\/object\/(?:sign|public|authenticated)\/attachments\//.test(value);
    if (property !== 'storagePath' && !isStorageUrl) return output;
    const path = normalizeStorageObjectPath(value);
    if (path) output.add(path);
    return output;
  }
  if (Array.isArray(value)) {
    value.forEach((item) => referencedPaths(item, output, property));
    return output;
  }
  if (value && typeof value === 'object') {
    Object.entries(value).forEach(([key, item]) => referencedPaths(item, output, key));
  }
  return output;
}

async function getFamilyData(familyId) {
  const { url, key } = config();
  const query = new URLSearchParams({
    family_id: `eq.${familyId}`,
    select: 'data',
    limit: '1',
  });
  const response = await fetch(`${url}/rest/v1/homefin_data?${query}`, {
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      Accept: 'application/json',
    },
    cache: 'no-store',
  });
  if (!response.ok) throw new Error(`Supabase dados familiares HTTP ${response.status}`);
  const rows = await response.json();
  return rows?.[0]?.data ?? null;
}

export async function assertFamilyOwnsObject(familyId, rawPath) {
  const path = normalizeStorageObjectPath(rawPath);
  if (!path) return false;
  if (path.startsWith(`${familyId}/`)) return true;
  const data = await getFamilyData(familyId);
  return referencedPaths(data).has(path);
}

async function listObjects(prefix, depth = 0) {
  if (depth > 8) throw new Error('Estrutura de pastas de anexos excede o limite.');
  const rows = [];
  for (let offset = 0; ; offset += 1000) {
    const page = await storageRequest(`object/list/${STORAGE_BUCKET}`, {
      method: 'POST',
      body: JSON.stringify({ prefix, limit: 1000, offset }),
    });
    if (!Array.isArray(page)) throw new Error('Resposta inválida ao listar anexos.');
    rows.push(...page);
    if (page.length < 1000) break;
  }
  const objects = [];
  for (const row of rows) {
    if (row && typeof row.name === 'string') {
      const path = prefix ? `${prefix}/${row.name}` : row.name;
      if (row.id === null) objects.push(...await listObjects(path, depth + 1));
      else objects.push(path);
    }
  }
  return objects;
}

export async function getFamilyStorageObjectPaths(familyId) {
  const data = await getFamilyData(familyId);
  const ownPrefix = await listObjects(familyId);
  const referenced = [...referencedPaths(data)];
  return [...new Set([
    ...ownPrefix,
    ...referenced.filter((path) => !path.includes('/')),
  ])];
}

export async function enqueueStorageCleanup(familyId, paths) {
  const normalized = [...new Set(paths.map(normalizeStorageObjectPath).filter(Boolean))];
  if (!normalized.length) return null;
  const rows = await databaseRequest('homefin_storage_cleanup_queue', {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify({
      family_id: familyId,
      object_paths: normalized,
    }),
  });
  if (!Array.isArray(rows) || typeof rows[0]?.id !== 'string') {
    throw new Error('O Supabase não confirmou a fila de limpeza de anexos.');
  }
  return rows[0].id;
}

export async function listStorageCleanupJobs() {
  const query = new URLSearchParams({
    select: 'id,family_id,object_paths',
    order: 'created_at.asc',
    limit: '100',
  });
  return await databaseRequest(`homefin_storage_cleanup_queue?${query}`) || [];
}

export async function isFamilyDeleted(familyId) {
  const globalRows = await databaseRequest('homefin_saas?id=eq.global&select=data&limit=1');
  if (!Array.isArray(globalRows) || !globalRows.length) {
    throw new Error('Não foi possível confirmar a exclusão da família.');
  }
  const families = globalRows[0]?.data?.families;
  if (Array.isArray(families) && families.some((family) => family?.id === familyId)) {
    return false;
  }

  const credentialsQuery = new URLSearchParams({
    family_id: `eq.${familyId}`,
    select: 'family_id',
    limit: '1',
  });
  const credentials = await databaseRequest(
    `homefin_family_credentials?${credentialsQuery}`
  );
  if (credentials?.length) return false;

  const dataQuery = new URLSearchParams({
    family_id: `eq.${familyId}`,
    select: 'family_id',
    limit: '1',
  });
  const financialRows = await databaseRequest(`homefin_data?${dataQuery}`);
  return !financialRows?.length;
}

export async function completeStorageCleanupJob(id) {
  const query = new URLSearchParams({ id: `eq.${id}` });
  await databaseRequest(`homefin_storage_cleanup_queue?${query}`, {
    method: 'DELETE',
    headers: { Prefer: 'return=minimal' },
  });
}

export async function pruneFamilyStorageObjects(familyId) {
  const data = await getFamilyData(familyId);
  const referenced = referencedPaths(data);
  const ownObjects = await listObjects(familyId);
  const stale = ownObjects.filter((path) => !referenced.has(path));
  await removeStorageObjects(stale);
  return stale.length;
}

export async function isFamilyObjectReferenced(familyId, path) {
  const data = await getFamilyData(familyId);
  return referencedPaths(data).has(path);
}

export async function uploadFamilyObject(familyId, name, contentType, bytes) {
  const safeName = name
    .normalize('NFKC')
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .slice(-120) || 'anexo';
  const path = `${familyId}/${Date.now()}_${randomUUID()}_${safeName}`;
  const { url, key } = config();
  const response = await fetch(
    `${url}/storage/v1/object/${STORAGE_BUCKET}/${encodedPath(path)}`,
    {
      method: 'POST',
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        'Content-Type': contentType,
        'x-upsert': 'false',
      },
      body: bytes,
      cache: 'no-store',
    }
  );
  if (!response.ok) {
    console.error('Falha no upload de anexo ao Supabase Storage:', response.status);
    throw new Error(`Supabase Storage HTTP ${response.status}`);
  }
  return { path, id: path, fullPath: `${STORAGE_BUCKET}/${path}` };
}

export async function signFamilyObject(path, expiresIn) {
  const signed = await storageRequest(`object/sign/${STORAGE_BUCKET}/${encodedPath(path)}`, {
    method: 'POST',
    body: JSON.stringify({ expiresIn }),
  });
  if (typeof signed?.signedURL !== 'string') {
    throw new Error('O Supabase não retornou uma URL assinada.');
  }
  const { url } = config();
  const signedPath = signed.signedURL.replace(/^\/+/, '').replace(/^storage\/v1\//, '');
  return new URL(signedPath, `${url}/storage/v1/`).toString();
}

export async function removeStorageObjects(paths) {
  const normalized = [...new Set(paths.map(normalizeStorageObjectPath).filter(Boolean))];
  for (let offset = 0; offset < normalized.length; offset += 100) {
    await storageRequest(`object/${STORAGE_BUCKET}`, {
      method: 'DELETE',
      body: JSON.stringify({ prefixes: normalized.slice(offset, offset + 100) }),
    });
  }
}
