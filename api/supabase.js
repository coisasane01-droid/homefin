export const config = {
  runtime: 'edge'
};

export default async function handler(req) {
  try {
    const url = process.env.VITE_SUPABASE_URL;
    const key = process.env.VITE_SUPABASE_ANON_KEY;

    const response = await fetch(
      `${url}/rest/v1/homefin_saas?select=id`,
      {
        method: 'GET',
        headers: {
          apikey: key,
          Authorization: `Bearer ${key}`,
          Accept: 'application/json'
        }
      }
    );

    const text = await response.text();

    return new Response(
      JSON.stringify({
        ok: response.ok,
        status: response.status,
        response: text
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );

  } catch (error) {
    return new Response(
      JSON.stringify({
        ok: false,
        error: error instanceof Error
          ? error.message
          : String(error)
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );
  }
}
