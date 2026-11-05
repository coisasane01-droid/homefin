import { verifyAdminSession } from './admin-auth.js';
import { validateFamilySession } from './_family-session.js';

function getConfig() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Configuração server-side do Supabase ausente.');
  return { url: url.replace(/\/+$/, ''), key };
}

async function requestSaas(options = {}) {
  const { url, key } = getConfig();
  const response = await fetch(`${url}/rest/v1/homefin_saas?id=eq.global&select=data`, {
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
  if (!response.ok) throw new Error(`Supabase SaaS HTTP ${response.status}`);
  return text ? JSON.parse(text) : null;
}

function redactSecrets(data) {
  if (!data || typeof data !== 'object') return data;
  const safe = structuredClone(data);
  if (safe.adminConfig) {
    delete safe.adminConfig.password;
    delete safe.adminConfig.recoveryKeyword;
  }
  if (safe.paymentConfig) delete safe.paymentConfig.mercadoPagoAccessToken;
  return safe;
}

function publicData(data) {
  const safe = redactSecrets(data || {});
  return {
    codes: Array.isArray(safe.codes)
      ? safe.codes.map(({ code, status, expiresAt, discountPercent, maxUses, usedCount }) =>
          ({ code, status, expiresAt, discountPercent, maxUses, usedCount }))
      : [],
    families: [],
    plans: Array.isArray(safe.plans) ? safe.plans : [],
    landingConfig: safe.landingConfig || {},
    paymentConfig: safe.paymentConfig || {},
    appBannerConfig: safe.appBannerConfig || {},
  };
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Método não permitido.' });
  }

  const { action, data, familyId } = req.body || {};
  const isAdmin = verifyAdminSession(req);

  if (action === 'get') {
    try {
      const rows = await requestSaas();
      const stored = rows?.[0]?.data || null;
      if (!stored) return res.status(200).json({ data: null });
      if (isAdmin) return res.status(200).json({ data: redactSecrets(stored) });

      const authorization = String(req.headers?.authorization || '');
      if (authorization) {
        let session;
        try {
          session = await validateFamilySession(req, familyId);
        } catch {
          return res.status(503).json({ error: 'Não foi possível validar a sessão familiar.' });
        }
        if (!session.valid) return res.status(401).json({ error: 'Sessão familiar inválida.' });
        const family = Array.isArray(stored.families)
          ? stored.families.find((item) => item?.id === session.familyId)
          : null;
        return res.status(200).json({
          data: {
            ...publicData(stored),
            families: family ? [family] : [],
          },
        });
      }

      return res.status(200).json({ data: publicData(stored) });
    } catch (error) {
      console.error('Erro ao consultar configuração SaaS:', error instanceof Error ? error.message : 'erro desconhecido');
      return res.status(503).json({ error: 'Não foi possível carregar a configuração do HomeFin.' });
    }
  }

  if (action !== 'save') {
    return res.status(400).json({ error: 'Ação SaaS inválida.' });
  }
  if (!isAdmin) return res.status(401).json({ error: 'Sessão administrativa inválida.' });
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return res.status(400).json({ error: 'Configuração SaaS inválida.' });
  }
  if (Buffer.byteLength(JSON.stringify(data), 'utf8') > 3_500_000) {
    return res.status(413).json({ error: 'Configuração SaaS excede o tamanho permitido.' });
  }

  try {
    const updated = await requestSaas({
      method: 'PATCH',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify({
        data: redactSecrets(data),
        updated_at: new Date().toISOString(),
      }),
    });
    if (!Array.isArray(updated) || updated.length !== 1) {
      return res.status(502).json({ error: 'O Supabase não confirmou a atualização SaaS.' });
    }
    return res.status(200).json({ data: redactSecrets(updated[0].data) });
  } catch (error) {
    console.error('Erro ao salvar configuração SaaS:', error instanceof Error ? error.message : 'erro desconhecido');
    return res.status(503).json({ error: 'Não foi possível salvar a configuração do HomeFin.' });
  }
}
