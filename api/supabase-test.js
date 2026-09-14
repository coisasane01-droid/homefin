export default async function handler(req, res) {
  try {
    const response = await fetch(
      'https://oyjtlanvozjbppvosbya.supabase.co/rest/v1/homefin_saas?select=id'
    );

    const text = await response.text();

    res.status(200).json({
      ok: true,
      status: response.status,
      body: text
    });
  } catch (error) {
    res.status(500).json({
      ok: false,
      error: error?.message || String(error),
      name: error?.name,
      code: error?.code,
      hostname: error?.hostname
    });
  }
}

