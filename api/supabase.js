cat > api/supabase.js <<'EOF'
export const config = {
  runtime: 'edge'
};

export default async function handler(req) {
  try {
    const response = await fetch('https://example.com');

    return new Response(
      JSON.stringify({
        ok: true,
        status: response.status
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
        error: error instanceof Error ? error.message : String(error)
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
EOF