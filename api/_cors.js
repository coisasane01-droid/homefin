const ALLOWED_ORIGINS = new Set([
  'https://homefinapp.vercel.app',
  'capacitor://localhost',
  'https://localhost',
  'http://localhost',
]);

// Em Preview, autoriza somente o hostname exato desta implantação Vercel.
// Não libera indiscriminadamente todos os domínios *.vercel.app.
function isCurrentVercelDeploymentOrigin(origin) {
  const deploymentHost = String(process.env.VERCEL_URL || '').trim().toLowerCase();
  if (!deploymentHost) return false;
  return origin === `https://${deploymentHost}`;
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
