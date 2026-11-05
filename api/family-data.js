import { validateFamilySession } from './_family-session.js';

const json = (res, status, body) => res.status(status).json(body);
const FAMILY_ID_PATTERN = /^[a-z0-9][a-z0-9-]{0,99}$/;

function getSupabaseConfig() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error('Configuração server-side do Supabase ausente.');
  }
  return { url: url.replace(/\/+$/, ''), key };
}

async function supabaseRequest(path, init = {}) {
  const { url, key } = getSupabaseConfig();
  const response = await fetch(`${url}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      ...init.headers,
    },
  });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Supabase family-data ${response.status}: ${detail}`);
  }
  if (response.status === 204) return null;
  const text = await response.text();
  return text ? JSON.parse(text) : null;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return json(res, 405, { error: 'Método não permitido.' });
  }

  const { action, data, expectedUpdatedAt } = req.body || {};
  const familyId = String(req.body?.familyId || '').trim();
  if (!FAMILY_ID_PATTERN.test(familyId)) {
    return json(res, 400, { error: 'Identificador familiar inválido.' });
  }
  if (!['get', 'save', 'exists', 'delete'].includes(action)) {
    return json(res, 400, { error: 'Operação de dados familiares inválida.' });
  }

  try {
    const session = await validateFamilySession(req, familyId);
    if (!session.valid) {
      return json(res, 401, { error: session.error || 'Sessão familiar inválida.' });
    }

    if (action === 'get' || action === 'exists') {
      const query = new URLSearchParams({
        family_id: `eq.${familyId}`,
        select: action === 'get' ? 'family_id,data,updated_at' : 'family_id',
      });
      const rows = await supabaseRequest(`homefin_data?${query}`);
      if (action === 'exists') {
        return json(res, 200, { success: true, exists: Array.isArray(rows) && rows.length > 0 });
      }
      return json(res, 200, {
        success: true,
        data: rows?.[0]?.data ?? null,
        updatedAt: rows?.[0]?.updated_at ?? null,
      });
    }

    if (action === 'delete') {
      await supabaseRequest(`homefin_data?family_id=eq.${encodeURIComponent(familyId)}`, {
        method: 'DELETE',
        headers: { Prefer: 'return=minimal' },
      });
      return json(res, 200, { success: true });
    }

    if (!data || typeof data !== 'object' || Array.isArray(data)) {
      return json(res, 400, { error: 'Dados familiares inválidos.' });
    }
    if (
      !Object.prototype.hasOwnProperty.call(req.body || {}, 'expectedUpdatedAt') ||
      (expectedUpdatedAt !== null &&
        (typeof expectedUpdatedAt !== 'string' || !Number.isFinite(Date.parse(expectedUpdatedAt))))
    ) {
      return json(res, 400, { error: 'Versão remota esperada ausente ou inválida. Atualize o aplicativo e tente novamente.' });
    }
    if (Buffer.byteLength(JSON.stringify(data), 'utf8') > 3_500_000) {
      return json(res, 413, { error: 'Os dados enviados excedem o limite permitido.' });
    }

    const record = {
      family_id: familyId,
      data,
      updated_at: new Date().toISOString(),
    };
    const saved = expectedUpdatedAt === null
      ? await supabaseRequest('homefin_data?on_conflict=family_id', {
          method: 'POST',
          headers: { Prefer: 'resolution=ignore-duplicates,return=representation' },
          body: JSON.stringify(record),
        })
      : await supabaseRequest(
          `homefin_data?family_id=eq.${encodeURIComponent(familyId)}&updated_at=eq.${encodeURIComponent(expectedUpdatedAt)}`,
          {
            method: 'PATCH',
            headers: { Prefer: 'return=representation' },
            body: JSON.stringify(record),
          }
        );

    if (!Array.isArray(saved) || saved.length !== 1) {
      return json(res, 409, {
        error: 'Os dados na nuvem foram atualizados em outro dispositivo. As alterações deste dispositivo foram preservadas localmente; revise a versão mais recente antes de sincronizar novamente.',
      });
    }
    return json(res, 200, { success: true, updatedAt: saved[0].updated_at });
  } catch (error) {
    console.error('Erro na API de dados familiares:', error instanceof Error ? error.message : error);
    return json(res, 503, { error: 'Não foi possível acessar os dados familiares.' });
  }
}
