export default async function handler(req, res) {
  try {
    const { path, method = 'GET', body } = req.body || {};

    if (!path) {
      return res.status(400).json({
        error: 'path não informado'
      });
    }

    const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
    const SUPABASE_KEY = process.env.VITE_SUPABASE_ANON_KEY;

    if (!SUPABASE_URL || !SUPABASE_KEY) {
      return res.status(500).json({
        error: 'Supabase não configurado na Vercel'
      });
    }

    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/${path}`,
      {
        method,
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${SUPABASE_KEY}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Prefer': 'return=representation'
        },
        body: body ? JSON.stringify(body) : undefined
      }
    );

    const text = await response.text();

    res.status(response.status);

    try {
      return res.json(text ? JSON.parse(text) : {});
    } catch {
      return res.send(text);
    }

  } catch (error) {
    console.error('Erro no proxy Supabase:', error);

    return res.status(500).json({
    error: 'Erro ao conectar ao Supabase',
    details: error?.message || 'Erro desconhecido',
    cause: error?.cause
      ? {
          name: error.cause.name,
          message: error.cause.message,
          code: error.cause.code,
          errno: error.cause.errno,
          syscall: error.cause.syscall
        }
      : null
  });
}