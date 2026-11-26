const ALLOWED_ORIGINS = new Set([
  'https://homefinapp.vercel.app',
  'capacitor://localhost',
  'https://localhost',
  'http://localhost',
]);

export function handleCors(req, res) {
  const origin = req.headers?.origin;

  const vercelOrigin = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : '';\n  const isAllowedVercelPreview = Boolean(vercelOrigin && origin === vercelOrigin);\n\n  if (origin && !ALLOWED_ORIGINS.has(origin) && !isAllowedVercelPreview) {
    res.setHeader('Vary', 'Origin');
    res.status(403).json({ error: 'Origem não autorizada.' });
    return true;
  }

  if (origin) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader(
      'Access-Control-Allow-Headers',
      'Content-Type, Authorization, Accept'
    );
    res.setHeader('Access-Control-Max-Age', '86400');
  }

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return true;
  }

  return false;
}
