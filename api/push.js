import webpush from 'web-push';
import { authorizePushIdentity } from './_push-authorization.js';
import { isSupportedPushEndpoint } from './_push-endpoint.js';

function configureWebPush() {
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
}

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
    throw new Error('Não foi possível consultar as inscrições Push.');
  }
  if (!text) return null;

  try {
    return JSON.parse(text);
  } catch {
    throw new Error('Resposta inválida do serviço de notificações.');
  }
}

function safeNotificationUrl(value, userType) {
  const fallback = userType === 'admin' ? '/admin/#/admin/panel' : '/';
  if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//') || value.includes('\\')) {
    return fallback;
  }
  const candidate = new URL(value, 'https://homefin.invalid');
  const isAdminPath = candidate.pathname === '/admin' || candidate.pathname.startsWith('/admin/');
  if ((userType === 'family' && isAdminPath) || (userType === 'admin' && !isAdminPath)) {
    return fallback;
  }
  return `${candidate.pathname}${candidate.search}${candidate.hash}`.slice(0, 2048);
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Método não permitido.' });
  }

  const { familyId, userType, title, body, url = '/' } = req.body || {};
  const identity = await authorizePushIdentity(req, familyId, userType);
  if (!identity.valid) {
    return res.status(identity.status).json({ error: identity.error });
  }
  if (
    typeof title !== 'string' ||
    !title.trim() ||
    title.length > 80 ||
    typeof body !== 'string' ||
    body.length > 500
  ) {
    return res.status(400).json({ error: 'Título ou mensagem de notificação inválidos.' });
  }

  try {
    configureWebPush();
    const params = new URLSearchParams({
      family_id: `eq.${identity.familyId}`,
      user_type: `eq.${identity.userType}`,
      select: 'subscription,endpoint',
    });
    const subscriptions = await supabaseRequest(`homefin_push_subscriptions?${params}`) || [];
    if (!subscriptions.length) {
      return res.status(200).json({
        success: false,
        sent: 0,
        failed: 0,
        subscriptions: 0,
        message: 'Nenhum dispositivo possui inscrição Push ativa para este perfil.',
      });
    }

    const payload = JSON.stringify({
      title: title.trim(),
      body: body.trim(),
      icon: '/pwa-192x192.png',
      badge: '/pwa-192x192.png',
      url: safeNotificationUrl(
        identity.userType === 'family' && url === '/'
          ? `/#/login?family=${encodeURIComponent(identity.familyId)}`
          : url,
        identity.userType
      ),
    });
    const results = await Promise.allSettled(subscriptions.map(async (row) => {
      if (!isSupportedPushEndpoint(row.endpoint)) {
        return { sent: false, expired: false, invalid: true };
      }
      try {
        await webpush.sendNotification(row.subscription, payload);
        return { sent: true };
      } catch (error) {
        const statusCode = Number(error?.statusCode || 0);
        if (statusCode !== 404 && statusCode !== 410) {
          console.error('Falha no envio Push:', { statusCode });
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

    for (const endpoint of expiredEndpoints) {
      const deleteParams = new URLSearchParams({
        endpoint: `eq.${endpoint}`,
        family_id: `eq.${identity.familyId}`,
        user_type: `eq.${identity.userType}`,
      });
      await supabaseRequest(`homefin_push_subscriptions?${deleteParams}`, {
        method: 'DELETE',
        headers: { Prefer: 'return=minimal' },
      });
    }

    const sent = results.filter(
      (result) => result.status === 'fulfilled' && result.value.sent
    ).length;
    const failed = results.length - sent;

    return res.status(200).json({
      success: sent > 0 && failed === 0,
      sent,
      failed,
      subscriptions: subscriptions.length,
      expiredRemoved: expiredEndpoints.length,
    });
  } catch (error) {
    console.error(
      'Erro no Push HomeFin:',
      error instanceof Error ? error.message : 'erro desconhecido'
    );
    return res.status(502).json({
      success: false,
      error: error instanceof Error ? error.message : 'Erro interno ao enviar Push.',
    });
  }
}
