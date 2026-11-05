import { authorizePushIdentity } from './_push-authorization.js';
import { isSupportedPushEndpoint } from './_push-endpoint.js';

async function supabaseRequest(path, options = {}) {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Configuração segura do Supabase indisponível.');
  }

  const response = await fetch(
    `${supabaseUrl.replace(/\/+$/, '')}/rest/v1/${path}`,
    {
      ...options,
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
        ...(options.headers || {}),
      },
    }
  );
  const text = await response.text();

  if (!response.ok) {
    console.error('Falha ao acessar inscrições Push no Supabase:', response.status);
    throw new Error('Não foi possível registrar a inscrição Push.');
  }
  if (!text) return null;

  try {
    return JSON.parse(text);
  } catch {
    throw new Error('Resposta inválida do serviço de notificações.');
  }
}

function isValidSubscription(subscription) {
  if (
    !subscription ||
    typeof subscription.endpoint !== 'string' ||
    subscription.endpoint.length > 2048 ||
    !subscription.keys ||
    typeof subscription.keys.p256dh !== 'string' ||
    !/^[A-Za-z0-9_-]{40,200}$/.test(subscription.keys.p256dh) ||
    typeof subscription.keys.auth !== 'string' ||
    !/^[A-Za-z0-9_-]{16,100}$/.test(subscription.keys.auth)
  ) {
    return false;
  }

  try {
    return isSupportedPushEndpoint(subscription.endpoint);
  } catch {
    return false;
  }
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  try {
    if (req.method === 'POST') {
      const { familyId, userType, subscription } = req.body || {};
      const identity = await authorizePushIdentity(req, familyId, userType);
      if (!identity.valid) {
        return res.status(identity.status).json({ error: identity.error });
      }
      if (!isValidSubscription(subscription)) {
        return res.status(400).json({ error: 'Inscrição Push inválida.' });
      }

      const params = new URLSearchParams({ on_conflict: 'endpoint' });
      const saved = await supabaseRequest(`homefin_push_subscriptions?${params}`, {
        method: 'POST',
        headers: { Prefer: 'resolution=merge-duplicates,return=representation' },
        body: JSON.stringify({
          family_id: identity.familyId,
          user_type: identity.userType,
          endpoint: subscription.endpoint,
          subscription,
          updated_at: new Date().toISOString(),
        }),
      });

      if (!Array.isArray(saved) || !saved.some((row) =>
        row.endpoint === subscription.endpoint &&
        row.family_id === identity.familyId &&
        row.user_type === identity.userType
      )) {
        return res.status(502).json({ error: 'O Supabase não confirmou a inscrição Push.' });
      }

      return res.status(200).json({ success: true, registered: true });
    }

    if (req.method === 'DELETE') {
      const { endpoint, familyId, userType } = req.body || {};
      const identity = await authorizePushIdentity(req, familyId, userType);
      if (!identity.valid) {
        return res.status(identity.status).json({ error: identity.error });
      }
      if (typeof endpoint !== 'string' || endpoint.length > 2048) {
        return res.status(400).json({ error: 'Endpoint da inscrição é inválido.' });
      }

      const params = new URLSearchParams({
        endpoint: `eq.${endpoint}`,
        family_id: `eq.${identity.familyId}`,
        user_type: `eq.${identity.userType}`,
      });
      const deleted = await supabaseRequest(`homefin_push_subscriptions?${params}`, {
        method: 'DELETE',
        headers: { Prefer: 'return=representation' },
      });

      return res.status(200).json({
        success: true,
        removed: Array.isArray(deleted) && deleted.length > 0,
      });
    }

    res.setHeader('Allow', 'POST, DELETE');
    return res.status(405).json({ error: 'Método não permitido.' });
  } catch (error) {
    console.error(
      'Erro ao registrar Push HomeFin:',
      error instanceof Error ? error.message : 'erro desconhecido'
    );
    return res.status(500).json({
      error: error instanceof Error
        ? error.message
        : 'Erro interno ao registrar notificação Push.',
    });
  }
}
