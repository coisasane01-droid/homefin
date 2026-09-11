const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.VITE_SUPABASE_ANON_KEY;

export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') {
      res.setHeader('Allow', ['POST']);
      return res.status(405).json({
        error: 'Método não permitido'
      });
    }

    if (!SUPABASE_URL || !SUPABASE_KEY) {
      return res.status(500).json({
        error: 'Variáveis do Supabase não configuradas na Vercel',
        urlConfigured: !!SUPABASE_URL,
        keyConfigured: !!SUPABASE_KEY
      });
    }

    const {
      path,
      method = 'GET',
      body
    } = req.body || {};

    if (!path) {
      return res.status(400).json({
        error: 'path não informado'
      });
    }

    const cleanPath = String(path).replace(/^\/+/, '');
    const url = `${SUPABASE_URL}/rest/v1/${cleanPath}`;

    const headers = {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'Accept-Profile': 'public',
      'Content-Profile': 'public'
    };

    const response = await fetch(url, {
      method: String(method).toUpperCase(),
      headers,
      body:
        body !== undefined &&
        String(method).toUpperCase() !== 'GET' &&
        String(method).toUpperCase() !== 'HEAD'
          ? JSON.stringify(body)
          : undefined
    });

    const text = await response.text();

    let responseData;

    try {
      responseData = text ? JSON.parse(text) : null;
    } catch {
      responseData = text;
    }

    return res.status(response.status).json(responseData);

  } catch (error) {
    console.error('ERRO NO PROXY SUPABASE:', error);

    const cause = error?.cause;

     return res.status(500).json({
      error: 'Erro ao conectar ao Supabase',
      details: error instanceof Error ? error.message : String(error),
      cause: cause
        ? {
            name: cause.name,
            message: cause.message,
            code: cause.code,
            errno: cause.errno,
            syscall: cause.syscall,
            hostname: cause.hostname
          }
        : null
    });
  }