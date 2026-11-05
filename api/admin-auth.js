import crypto from 'node:crypto';

function safeEqual(a, b) {
  const left = Buffer.from(String(a || ''), 'utf8');
  const right = Buffer.from(String(b || ''), 'utf8');
  return left.length === right.length &&
    crypto.timingSafeEqual(left, right);
}

function sign(payload, secret) {
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto.createHmac('sha256', secret)
    .update(encoded)
    .digest('base64url');
  return `${encoded}.${signature}`;
}

function verify(token, secret) {
  if (typeof token !== 'string') return false;
  const parts = token.split('.');
  if (parts.length !== 2) return false;

  const [encoded, signature] = parts;
  const expected = crypto.createHmac('sha256', secret)
    .update(encoded)
    .digest('base64url');

  if (!safeEqual(signature, expected)) return false;

  try {
    const payload = JSON.parse(
      Buffer.from(encoded, 'base64url').toString('utf8')
    );
    return payload.role === 'admin' &&
      Number.isFinite(payload.exp) &&
      payload.exp > Math.floor(Date.now() / 1000);
  } catch {
    return false;
  }
}


// Validação reutilizável pelas APIs administrativas do servidor.
// Não confia em flags armazenadas no navegador.
export function verifyAdminSession(req) {
  return getAdminSessionReference(req) !== null;
}

export function getAdminSessionReference(req) {
  const secret = process.env.HOMEFIN_ADMIN_SECRET;
  if (!secret || secret.length < 20) return null;

  const authorization = String(req.headers?.authorization || '');
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  if (!match || !verify(match[1], secret)) return null;

  return crypto.createHash('sha256')
    .update(match[1])
    .digest('hex');
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Método não permitido.' });
  }

  const secret = process.env.HOMEFIN_ADMIN_SECRET;
  if (!secret || secret.length < 20) {
    return res.status(503).json({
      error: 'Autenticação administrativa não configurada no servidor.'
    });
  }

  const action = req.body?.action;

  if (action === 'login') {
    const password = req.body?.password;
    if (typeof password !== 'string' || !safeEqual(password, secret)) {
      return res.status(401).json({ error: 'Acesso negado.' });
    }

    const now = Math.floor(Date.now() / 1000);
    const expiresAt = (now + 12 * 60 * 60) * 1000;
    const token = sign({
      role: 'admin',
      jti: crypto.randomUUID(),
      iat: now,
      exp: Math.floor(expiresAt / 1000)
    }, secret);

    return res.status(200).json({ ok: true, token, expiresAt });
  }

  if (action === 'verify') {
    const authorization = String(req.headers?.authorization || '');
    const token = authorization.startsWith('Bearer ')
      ? authorization.slice(7)
      : '';

    if (!verify(token, secret)) {
      return res.status(401).json({ ok: false });
    }
    return res.status(200).json({ ok: true });
  }

  return res.status(400).json({ error: 'Ação inválida.' });
}
