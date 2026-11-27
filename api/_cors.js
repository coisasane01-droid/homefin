const ALLOWED_ORIGINS = new Set([
  'https://homefinapp.vercel.app',
  'capacitor://localhost',
  'https://localhost',
  'http://localhost',
]);

// Preview deployments use unique Vercel aliases. Permit only an exact
// same-origin request to the host serving this function; never wildcard
// arbitrary *.vercel.app origins.
function isSameVercelOrigin(req, origin) {
  try {
    const parsed = new URL(origin);
    const requestHost = String(req.headers?.host || '').trim().toLowerCase();
    const originHost = parsed.host.toLowerCase();
    return parsed.protocol === 'https:' &&
      originHost === requestHost &&
      parsed.hostname.toLowerCase().endsWith('.vercel.app');
  } catch {
    return false;
  }
}

export function handleCors(req, res) {
  const origin = req.headers?.origin;

  if (origin && !ALLOWED_ORIGINS.has(origin) && !isSameVercelOrigin(req, origin)) {
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
