import webpush from 'web-push';
import { validateFamilySession } from './_family-session.js';
import { isSupportedPushEndpoint } from './_push-endpoint.js';
import { verifyAdminSession } from './admin-auth.js';

const FAMILY_ID_PATTERN = /^[a-z0-9][a-z0-9-]{0,99}$/;

function config() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Configuração server-side do Supabase ausente.');
  return { url: url.replace(/\/+$/, ''), key };
}

async function request(path, options = {}) {
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
  if (!response.ok) throw new Error(`Supabase suporte HTTP ${response.status}`);
  return text ? JSON.parse(text) : null;
}

async function notifyAdminPushSubscribers() {
  try {
    const publicKey = process.env.VAPID_PUBLIC_KEY;
    const privateKey = process.env.VAPID_PRIVATE_KEY;
    if (!publicKey || !privateKey) {
      throw new Error('Chaves VAPID não configuradas no servidor.');
    }

    webpush.setVapidDetails(
      process.env.VAPID_SUBJECT || 'https://homefinapp.vercel.app',
      publicKey,
      privateKey
    );

    const query = new URLSearchParams({
      family_id: 'eq.admin',
      user_type: 'eq.admin',
      select: 'subscription,endpoint',
    });
    const subscriptions = await request(`homefin_push_subscriptions?${query}`) || [];
    const results = await Promise.allSettled(subscriptions.map(async (row) => {
      if (!isSupportedPushEndpoint(row.endpoint)) return { sent: false };
      try {
        await webpush.sendNotification(row.subscription, JSON.stringify({
          title: 'Suporte HomeFin',
          body: 'Uma família enviou uma nova mensagem.',
          icon: '/homefin-admin-icon-192.png',
          badge: '/homefin-admin-icon-192.png',
          url: '/admin/#/admin/panel',
        }));
        return { sent: true };
      } catch (error) {
        const statusCode = Number(error?.statusCode || 0);
        if (statusCode !== 404 && statusCode !== 410) {
          console.error('Falha ao enviar Push de suporte ao administrador:', { statusCode });
        }
        return {
          sent: false,
          expired: statusCode === 404 || statusCode === 410,
          endpoint: row.endpoint,
        };
      }
    }));

    const expiredEndpoints = results
      .filter((result) => result.status === 'fulfilled' && result.value.expired)
      .map((result) => result.value.endpoint)
      .filter(Boolean);

    const cleanupResults = await Promise.allSettled(expiredEndpoints.map((endpoint) => {
      const deleteQuery = new URLSearchParams({
        endpoint: `eq.${endpoint}`,
        family_id: 'eq.admin',
        user_type: 'eq.admin',
      });
      return request(`homefin_push_subscriptions?${deleteQuery}`, {
        method: 'DELETE',
        headers: { Prefer: 'return=minimal' },
      });
    }));
    cleanupResults.forEach((result) => {
      if (result.status === 'rejected') {
        console.error(
          'Não foi possível remover inscrição Push administrativa expirada:',
          result.reason instanceof Error ? result.reason.message : 'erro desconhecido'
        );
      }
    });
  } catch (error) {
    console.error(
      'Não foi possível enviar a notificação Push de suporte:',
      error instanceof Error ? error.message : 'erro desconhecido'
    );
  }
}

async function authorize(req, familyId) {
  if (verifyAdminSession(req)) return { valid: true, admin: true, familyId };
  if (!FAMILY_ID_PATTERN.test(familyId)) {
    return { valid: false, status: 400, error: 'Identificador familiar inválido.' };
  }
  try {
    const session = await validateFamilySession(req, familyId);
    return session.valid
      ? { valid: true, admin: false, familyId: session.familyId }
      : { valid: false, status: 401, error: session.error || 'Sessão inválida.' };
  } catch (error) {
    console.error('Falha ao validar sessão do suporte:', error instanceof Error ? error.message : 'erro desconhecido');
    return { valid: false, status: 503, error: 'Não foi possível validar a sessão familiar.' };
  }
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Método não permitido.' });
  }

  const { action, familyId: suppliedFamilyId, message, blocked, resolved } = req.body || {};
  const familyId = typeof suppliedFamilyId === 'string' ? suppliedFamilyId : '';
  const identity = await authorize(req, familyId);
  if (!identity.valid) return res.status(identity.status).json({ error: identity.error });
  if (!['get-messages', 'get-settings', 'send-message', 'set-blocked', 'get-unread', 'mark-read', 'resolve', 'delete'].includes(action)) {
    return res.status(400).json({ error: 'Operação de suporte inválida.' });
  }

  const familyQuery = new URLSearchParams({ family_id: `eq.${identity.familyId}` });
  try {
    if (action === 'get-messages') {
      const query = new URLSearchParams({
        ...Object.fromEntries(familyQuery),
        select: 'id,family_id,sender_type,message,read_at,created_at',
        order: 'created_at.asc',
      });
      return res.status(200).json({ messages: await request(`homefin_support_messages?${query}`) || [] });
    }

    if (action === 'get-settings') {
      const query = new URLSearchParams({
        ...Object.fromEntries(familyQuery),
        select: 'family_id,blocked,resolved,resolved_at,updated_at',
        limit: '1',
      });
      const rows = await request(`homefin_support_settings?${query}`);
      return res.status(200).json({ settings: rows?.[0] || null });
    }

    if (action === 'send-message') {
      const cleanMessage = typeof message === 'string' ? message.trim() : '';
      if (!cleanMessage || cleanMessage.length > 4000) {
        return res.status(400).json({ error: 'A mensagem deve conter entre 1 e 4000 caracteres.' });
      }
      if (!identity.admin) {
        const settings = await request(`homefin_support_settings?${new URLSearchParams({
          ...Object.fromEntries(familyQuery),
          select: 'blocked',
          limit: '1',
        })}`);
        if (settings?.[0]?.blocked) {
          return res.status(403).json({ error: 'O envio de mensagens está temporariamente bloqueado.' });
        }
      }
      const rows = await request('homefin_support_messages', {
        method: 'POST',
        headers: { Prefer: 'return=representation' },
        body: JSON.stringify({
          family_id: identity.familyId,
          sender_type: identity.admin ? 'admin' : 'family',
          message: cleanMessage,
        }),
      });
      if (!Array.isArray(rows) || !rows[0]) {
        return res.status(502).json({ error: 'O servidor não confirmou o envio da mensagem.' });
      }
      if (!identity.admin) await notifyAdminPushSubscribers();
      return res.status(200).json({ message: rows[0] });
    }

    if (action === 'set-blocked' || action === 'resolve') {
      if (!identity.admin) return res.status(403).json({ error: 'Apenas administradores podem alterar essa configuração.' });
      if (action === 'set-blocked' && typeof blocked !== 'boolean') {
        return res.status(400).json({ error: 'Valor de bloqueio inválido.' });
      }
      if (action === 'resolve' && typeof resolved !== 'boolean') {
        return res.status(400).json({ error: 'Valor de resolução inválido.' });
      }
      const values = {
        family_id: identity.familyId,
        updated_at: new Date().toISOString(),
        ...(action === 'set-blocked' ? { blocked } : {
          resolved,
          resolved_at: resolved ? new Date().toISOString() : null,
        }),
      };
      const rows = await request('homefin_support_settings?on_conflict=family_id', {
        method: 'POST',
        headers: { Prefer: 'resolution=merge-duplicates,return=representation' },
        body: JSON.stringify(values),
      });
      if (!Array.isArray(rows) || !rows[0]) {
        return res.status(502).json({ error: 'O servidor não confirmou a atualização do suporte.' });
      }
      return res.status(200).json({ settings: rows[0] });
    }

    if (action === 'get-unread') {
      if (!identity.admin) return res.status(403).json({ error: 'Apenas administradores podem consultar todas as mensagens.' });
      const query = new URLSearchParams({
        sender_type: 'eq.family',
        read_at: 'is.null',
        select: 'id,family_id,sender_type,message,read_at,created_at',
        order: 'created_at.asc',
      });
      return res.status(200).json({ messages: await request(`homefin_support_messages?${query}`) || [] });
    }

    if (action === 'mark-read') {
      const query = new URLSearchParams({
        ...Object.fromEntries(familyQuery),
        sender_type: `eq.${identity.admin ? 'family' : 'admin'}`,
        read_at: 'is.null',
      });
      const rows = await request(`homefin_support_messages?${query}`, {
        method: 'PATCH',
        headers: { Prefer: 'return=representation' },
        body: JSON.stringify({ read_at: new Date().toISOString() }),
      });
      return res.status(200).json({ updated: Array.isArray(rows) ? rows.length : 0 });
    }

    const query = new URLSearchParams(Object.fromEntries(familyQuery));
    await request(`homefin_support_messages?${query}`, { method: 'DELETE' });
    await request(`homefin_support_settings?${query}`, { method: 'DELETE' });
    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('Erro na API de suporte:', error instanceof Error ? error.message : 'erro desconhecido');
    return res.status(503).json({ error: 'Não foi possível concluir a operação de suporte.' });
  }
}
