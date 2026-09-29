import webpush from 'web-push';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY;

const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY;
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;
const VAPID_SUBJECT =
  process.env.VAPID_SUBJECT || 'https://homefinapp.vercel.app';

function configureWebPush() {
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
    throw new Error('VAPID keys não configuradas no servidor.');
  }

  webpush.setVapidDetails(
    VAPID_SUBJECT,
    VAPID_PUBLIC_KEY,
    VAPID_PRIVATE_KEY
  );
}

async function supabaseRequest(path, options = {}) {
  const response = await fetch(`${SUPABASE_URL}${path}`, {
    ...options,
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
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
        : data?.message ||
          data?.error ||
          `Supabase HTTP ${response.status}`
    );
  }

  return data;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({
      error: 'Método não permitido.',
    });
  }

  try {
    configureWebPush();

    const {
      familyId,
      userType,
      title,
      body,
      url = '/',
    } = req.body || {};

    if (!familyId || !userType || !title) {
      return res.status(400).json({
        error: 'familyId, userType e title são obrigatórios.',
      });
    }

    const subscriptions = await supabaseRequest(
      `/rest/v1/homefin_push_subscriptions?family_id=eq.${encodeURIComponent(
        familyId
      )}&user_type=eq.${encodeURIComponent(userType)}&select=subscription`
    );

    const payload = JSON.stringify({
      title,
      body: body || '',
      icon: '/pwa-192x192.png',
      badge: '/pwa-192x192.png',
      url,
    });

    const results = await Promise.allSettled(
      (subscriptions || []).map(async (row) => {
        try {
          await webpush.sendNotification(row.subscription, payload);

          return {
            success: true,
          };
        } catch (error) {
          if (error?.statusCode === 404 || error?.statusCode === 410) {
            return {
              success: false,
              expired: true,
            };
          }

          throw error;
        }
      })
    );

    const expired = [];

    (subscriptions || []).forEach((row, index) => {
      if (
        results[index].status === 'fulfilled' &&
        results[index].value?.expired
      ) {
        expired.push(row.subscription.endpoint);
      }
    });

    for (const endpoint of expired) {
      await supabaseRequest(
        `/rest/v1/homefin_push_subscriptions?endpoint=eq.${encodeURIComponent(
          endpoint
        )}`,
        {
          method: 'DELETE',
        }
      );
    }

    return res.status(200).json({
      success: true,
      sent: results.filter(
        (result) =>
          result.status === 'fulfilled' && result.value?.success
      ).length,
      subscriptions: subscriptions?.length || 0,
    });
  } catch (error) {
    console.error('Erro no Push HomeFin:', error);

    return res.status(500).json({
      error: error?.message || 'Erro interno ao enviar Push.',
    });
  }
}
