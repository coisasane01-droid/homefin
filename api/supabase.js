export const config = {
  runtime: 'edge'
};

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.VITE_SUPABASE_ANON_KEY;

export default async function handler(req) {
  try {
    if (req.method !== 'POST') {
      return new Response(
        JSON.stringify({
          error: 'Método não permitido'
        }),
        {
          status: 405,
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );
    }

    if (!SUPABASE_URL || !SUPABASE_KEY) {
      return new Response(
        JSON.stringify({
          error: 'Variáveis do Supabase não configuradas na Vercel',
          urlConfigured: !!SUPABASE_URL,
          keyConfigured: !!SUPABASE_KEY
        }),
        {
          status: 500,
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );
    }

    const { path, method = 'GET', body } = await req.json();

    if (!path) {
      return new Response(
        JSON.stringify({
          error: 'path não informado'
        }),
        {
          status: 400,
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );
    }

    const cleanPath = String(path).replace(/^\/+/, '');

    const url = `${SUPABASE_URL}/rest/v1/${cleanPath}`;

    const upperMethod = String(method).toUpperCase();

    const headers = {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'Accept-Profile': 'public',
      'Content-Profile': 'public'
    };

    const response = await fetch(url, {
      method: upperMethod,
      headers,
      body:
        body !== undefined &&
        upperMethod !== 'GET' &&
        upperMethod !== 'HEAD'
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

    return new Response(
      JSON.stringify(responseData),
      {
        status: response.status,
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );

  } catch (error) {
    return new Response(
      JSON.stringify({
        error: 'Erro ao conectar ao Supabase',
        details: error instanceof Error
          ? error.message
          : String(error)
      }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );
  }
}