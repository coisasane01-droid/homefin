const ALLOWED_ORIGINS = new Set([
  'https://homefinapp.vercel.app',
  'capacitor://localhost',
  'https://localhost',
  'http://localhost',
]);

// Em Preview, autoriza apenas os hosts exatos atribuídos pela Vercel
// à implantação e à branch. Não libera indiscriminadamente *.vercel.app.
function isCurrentVercelDeploymentOrigin(origin) {
  const assignedHosts = [
    process.env.VERCEL_URL,
    process.env.VERCEL_BRANCH_URL,
  ]
    .map((value) => String(value || '').trim().toLowerCase())
    .map((value) => value.replace(/^https?:\\/\\//, '').replace(/\\/$/, ''))
    .filter(Boolean);

  return assignedHosts.some((host) => origin === `https://${host}`);
}

export function handleCors(req, res) {
  const origin = req.headers?.origin;

  if (origin && !ALLOWED_ORIGINS.has(origin) && !isCurrentVercelDeploymentOrigin(origin)) {
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
