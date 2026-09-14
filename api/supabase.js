export const config = {
  runtime: 'edge'
};

export default async function handler(req) {
  try {
    return new Response(
      JSON.stringify({
        ok: true,
        runtime: 'edge',
        method: req.method,
        envUrl: !!process.env.VITE_SUPABASE_URL,
        envKey: !!process.env.VITE_SUPABASE_ANON_KEY
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
        status: 500,
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );
  }
}
