import webpush from 'web-push';
import { verifyAdminSession } from './admin-auth.js';
import { isSupportedPushEndpoint } from './_push-endpoint.js';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const FAMILY_ID_PATTERN = /^[a-z0-9][a-z0-9-]{0,99}$/;

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
  const response = await fetch(`${SUPABASE_URL}${path}`, {
    ...options,
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });

  const text = await response.text();
  let data = null;

  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }

  if (!response.ok) {
    throw new Error(
      typeof data === 'string'
        ? data
        : data?.message || data?.error || `Supabase HTTP ${response.status}`
    );
  }

  return data;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido.' });
  }

  if (!SUPABASE_SERVICE_ROLE_KEY || !SUPABASE_URL) {
    return res.status(500).json({
      error: 'Configuração segura de envio em massa incompleta no servidor.',
    });
  }

  if (!verifyAdminSession(req)) {
    return res.status(401).json({ error: 'Acesso não autorizado.' });
  }

  const title = String(req.body?.title || '').trim();
  const body = String(req.body?.body || '').trim();

  if (!title || title.length > 80 || !body || body.length > 500) {
    return res.status(400).json({
      error: 'Informe título (até 80 caracteres) e mensagem (até 500 caracteres).',
    });
  }

  try {
    configureWebPush();

    const subscriptions = await supabaseRequest(
      '/rest/v1/homefin_push_subscriptions?user_type=eq.family&select=subscription,endpoint,family_id'
    );

    const results = await Promise.allSettled(
      (subscriptions || []).map(async (row) => {
        try {
          if (typeof row.family_id !== 'string' || !FAMILY_ID_PATTERN.test(row.family_id)) {
            return { success: false, statusCode: 'invalid_family', message: 'Identidade familiar inválida.' };
          }
          if (!isSupportedPushEndpoint(row.endpoint)) {
            return { success: false, statusCode: 'invalid_endpoint', message: 'Endpoint Push incompatível.' };
          }
          const payload = JSON.stringify({
            title: title.startsWith('HomeFin - ') ? title : `HomeFin - ${title}`,
            body,
            icon: '/pwa-192x192.png',
            badge: '/pwa-192x192.png',
            url: `/#/login?family=${encodeURIComponent(row.family_id)}`,
          });
          await webpush.sendNotification(row.subscription, payload);
          return { success: true };
        } catch (error) {
          const statusCode = Number(error?.statusCode || 0);
          const message = String(error?.message || 'Erro Push desconhecido')
            .replace(/https?:\/\/\S+/gi, '[URL ocultada]')
            .slice(0, 300);

          // Diagnóstico seguro: não registrar endpoint, inscrição ou chaves.
          const responseBody = String(error?.body || '')
            .replace(/https?:\/\/\S+/gi, '[URL ocultada]')
            .replace(/Bearer\s+\S+/gi, 'Bearer [ocultado]')
            .slice(0, 500);

          const responseContentType = String(
            error?.headers?.['content-type'] || ''
          ).slice(0, 100);

          console.error('Falha em uma inscrição Push:', {
            statusCode,
            message,
            responseBody: responseBody || '(sem corpo de resposta)',
            responseContentType: responseContentType || '(não informado)',
          });

          if (statusCode === 404 || statusCode === 410) {
            return {
              success: false,
              expired: true,
              endpoint: row.endpoint,
              familyId: row.family_id,
              statusCode,
              message,
            };
          }

          return { success: false, statusCode, message };
        }
      })
    );

    const expiredEndpoints = results
      .filter((result) => result.status === 'fulfilled' && result.value?.expired)
      .map((result) => ({
        endpoint: result.value.endpoint,
        familyId: result.value.familyId,
      }))
      .filter((row) => row.endpoint && row.familyId);

    for (const { endpoint, familyId } of expiredEndpoints) {
      const params = new URLSearchParams({
        endpoint: `eq.${endpoint}`,
        family_id: `eq.${familyId}`,
        user_type: 'eq.family',
      });
      await supabaseRequest(
        `/rest/v1/homefin_push_subscriptions?${params}`,
        { method: 'DELETE' }
      );
    }

    const sent = results.filter(
      (result) => result.status === 'fulfilled' && result.value?.success
    ).length;

    const failuresByStatus = {};
    const failureMessages = [];

    for (const result of results) {
      if (result.status === 'fulfilled' && !result.value?.success) {
        const code = String(result.value?.statusCode || 'unknown');
        failuresByStatus[code] = (failuresByStatus[code] || 0) + 1;
        failureMessages.push({
          statusCode: code,
          message: String(result.value?.message || 'Sem mensagem detalhada').slice(0, 300),
        });
      } else if (result.status === 'rejected') {
        failuresByStatus.unknown = (failuresByStatus.unknown || 0) + 1;
        failureMessages.push({
          statusCode: 'unknown',
          message: 'Ocorreu uma falha inesperada ao processar esta inscrição.',
        });
      }
    }

    const failed = results.length - sent;

    return res.status(200).json({
      success: sent > 0 && failed === 0,
      sent,
      failed,
      failuresByStatus,
      failureMessages,
      subscriptions: subscriptions?.length || 0,
      expiredRemoved: expiredEndpoints.length,
    });
  } catch (error) {
    console.error(
      'Erro no Push em massa HomeFin:',
      error instanceof Error ? error.message : 'erro desconhecido'
    );
    return res.status(500).json({
      error: 'Não foi possível concluir o envio em massa.',
    });
  }
}
