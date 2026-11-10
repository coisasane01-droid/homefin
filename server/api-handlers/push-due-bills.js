import crypto from 'crypto';
import webpush from 'web-push';
import { isSupportedPushEndpoint } from '../../api/_push-endpoint.js';

const FAMILY_ID_PATTERN = /^[a-z0-9][a-z0-9-]{0,99}$/;

function authorized(req) {
  const expected = process.env.HOMEFIN_CRON_SECRET || '';
  const match = String(req.headers?.authorization || '').match(/^Bearer\s+(.+)$/i);
  const supplied = match?.[1] || '';
  if (!expected || expected.length < 32 || !supplied) return false;
  const a = Buffer.from(expected);
  const b = Buffer.from(supplied);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function saoPauloDate(offsetDays = 0) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map(p => [p.type, p.value]));
  const base = new Date(Date.UTC(
    Number(values.year), Number(values.month) - 1, Number(values.day) + offsetDays
  ));
  return `${base.getUTCFullYear()}-${String(base.getUTCMonth() + 1).padStart(2, '0')}-${String(base.getUTCDate()).padStart(2, '0')}`;
}

function configureWebPush() {
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!publicKey || !privateKey) throw new Error('Chaves VAPID não configuradas.');
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || 'https://homefinapp.vercel.app',
    publicKey,
    privateKey
  );
}

function supabaseConfig() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Configuração segura do Supabase indisponível.');
  return { url: url.replace(/\/+$/, ''), key };
}

async function dbRequest(path, init = {}) {
  const { url, key } = supabaseConfig();
  const response = await fetch(`${url}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...(init.headers || {}),
    },
    cache: 'no-store',
  });
  const body = await response.text();
  if (!response.ok) {
    console.error('Falha na rotina automática Push:', response.status, body.slice(0, 300));
    throw new Error('Falha ao consultar ou atualizar o banco de notificações.');
  }
  if (!body) return null;
  return JSON.parse(body);
}

async function claimNotice(familyId, billId, dueDate, noticeType) {
  const result = await dbRequest('rpc/homefin_claim_push_due_bill', {
    method: 'POST',
    body: JSON.stringify({
      p_family_id: familyId,
      p_bill_id: billId,
      p_due_date: dueDate,
      p_notice_type: noticeType,
    }),
  });
  return result === true || (Array.isArray(result) && result[0] === true);
}

async function finishNotice(familyId, billId, dueDate, noticeType, sent) {
  const params = new URLSearchParams({
    family_id: `eq.${familyId}`,
    bill_id: `eq.${billId}`,
    due_date: `eq.${dueDate}`,
    notice_type: `eq.${noticeType}`,
  });
  if (sent) {
    await dbRequest(`homefin_push_due_notices?${params}`, {
      method: 'PATCH',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({ status: 'sent', sent_at: new Date().toISOString() }),
    });
  } else {
    await dbRequest(`homefin_push_due_notices?${params}`, {
      method: 'DELETE',
      headers: { Prefer: 'return=minimal' },
    });
  }
}

function notificationUrl(familyId) {
  return `https://homefinapp.vercel.app/#/login?family=${encodeURIComponent(familyId)}`;
}

async function removeExpired(endpoint, familyId) {
  const params = new URLSearchParams({
    endpoint: `eq.${endpoint}`,
    family_id: `eq.${familyId}`,
    user_type: 'eq.family',
  });
  await dbRequest(`homefin_push_subscriptions?${params}`, {
    method: 'DELETE',
    headers: { Prefer: 'return=minimal' },
  });
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Método não permitido.' });
  }
  if (!authorized(req)) {
    return res.status(401).json({ error: 'Não autorizado.' });
  }

  try {
    configureWebPush();

    const today = saoPauloDate(0);
    const tomorrow = saoPauloDate(1);
    const rows = await dbRequest(
      'homefin_data?select=family_id,data'
    ) || [];

    let checked = 0;
    let sentNotices = 0;
    let failedNotices = 0;
    let skipped = 0;

    for (const row of rows) {
      const familyId = row?.family_id;
      const data = row?.data;
      if (
        typeof familyId !== 'string' ||
        !FAMILY_ID_PATTERN.test(familyId) ||
        !data ||
        data.settings?.notificationsEnabled !== true ||
        data.settings?.notificationPreferences?.push === false
      ) {
        skipped++;
        continue;
      }

      const subscriptionsQuery = new URLSearchParams({
        family_id: `eq.${familyId}`,
        user_type: 'eq.family',
        select: 'subscription,endpoint',
      });
      const subscriptions = await dbRequest(
        `homefin_push_subscriptions?${subscriptionsQuery}`
      ) || [];

      if (!subscriptions.length) {
        skipped++;
        continue;
      }

      const bills = Array.isArray(data.bills) ? data.bills : [];
      for (const bill of bills) {
        if (
          !bill ||
          typeof bill.id !== 'string' ||
          bill.status !== 'pending' ||
          ![today, tomorrow].includes(bill.dueDate)
        ) continue;

        const noticeType = bill.dueDate === today ? 'due_today' : 'due_tomorrow';
        checked++;

        const claimed = await claimNotice(
          familyId, bill.id, bill.dueDate, noticeType
        );
        if (!claimed) continue;

        const amount = (Number(bill.amount || 0) + Number(bill.subCategoryAmount || 0))
          .toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
        const title = noticeType === 'due_today'
          ? 'Conta vencendo hoje!'
          : 'Conta vence amanhã!';
        const message = `A conta "${String(bill.description || 'Conta').slice(0, 120)}" ${noticeType === 'due_today' ? 'vence hoje' : 'vence amanhã'}. Valor: ${amount}`;

        const payload = JSON.stringify({
          title,
          body: message,
          icon: '/pwa-192x192.png',
          badge: '/pwa-192x192.png',
          url: notificationUrl(familyId),
        });

        const results = await Promise.allSettled(subscriptions.map(async subscription => {
          if (!isSupportedPushEndpoint(subscription.endpoint)) {
            return { sent: false, expired: false };
          }
          try {
            await webpush.sendNotification(subscription.subscription, payload);
            return { sent: true, expired: false };
          } catch (error) {
            const status = Number(error?.statusCode || 0);
            return {
              sent: false,
              expired: status === 404 || status === 410,
              endpoint: subscription.endpoint,
            };
          }
        }));

        const outcomes = results
          .filter(result => result.status === 'fulfilled')
          .map(result => result.value);
        const successful = outcomes.filter(result => result.sent).length;
        const expired = outcomes.filter(result => result.expired);

        for (const item of expired) {
          try {
            await removeExpired(item.endpoint, familyId);
          } catch (error) {
            console.error('Não foi possível remover inscrição Push expirada.');
          }
        }

        await finishNotice(
          familyId, bill.id, bill.dueDate, noticeType, successful > 0
        );

        if (successful > 0) sentNotices++;
        else failedNotices++;
      }
    }

    return res.status(200).json({
      success: true,
      checked,
      sentNotices,
      failedNotices,
      skipped,
      date: today,
      timezone: 'America/Sao_Paulo',
    });
  } catch (error) {
    console.error(
      'Erro na rotina automática Push:',
      error instanceof Error ? error.message : 'erro desconhecido'
    );
    return res.status(500).json({ error: 'Falha na rotina automática de notificações.' });
  }
}
