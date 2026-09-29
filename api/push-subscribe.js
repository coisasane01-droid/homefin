const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY;

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
  try {
    if (req.method === 'POST') {
      const {
        familyId,
        userType,
        subscription,
      } = req.body || {};

      if (!familyId || !userType || !subscription?.endpoint) {
        return res.status(400).json({
          error:
            'familyId, userType e subscription são obrigatórios.',
        });
      }

      if (!['family', 'admin'].includes(userType)) {
        return res.status(400).json({
          error: 'userType inválido.',
        });
      }

      await supabaseRequest(
        '/rest/v1/homefin_push_subscriptions?on_conflict=endpoint',
        {
          method: 'POST',
          headers: {
            Prefer: 'resolution=merge-duplicates,return=minimal',
          },
          body: JSON.stringify({
            family_id: familyId,
            user_type: userType,
            endpoint: subscription.endpoint,
            subscription,
            updated_at: new Date().toISOString(),
          }),
        }
      );

      return res.status(200).json({
        success: true,
      });
    }

    if (req.method === 'DELETE') {
      const endpoint = req.query?.endpoint;

      if (!endpoint) {
        return res.status(400).json({
          error: 'endpoint é obrigatório.',
        });
      }

      await supabaseRequest(
        `/rest/v1/homefin_push_subscriptions?endpoint=eq.${encodeURIComponent(
          endpoint
        )}`,
        {
          method: 'DELETE',
        }
      );

      return res.status(200).json({
        success: true,
      });
    }

    return res.status(405).json({
      error: 'Método não permitido.',
    });
  } catch (error) {
    console.error('Erro ao registrar Push HomeFin:', error);

    return res.status(500).json({
      error:
        error?.message ||
        'Erro interno ao registrar notificação Push.',
    });
  }
}
