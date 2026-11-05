import crypto from 'crypto';

function safeEqual(a, b) {
  const left = Buffer.from(String(a || ''));
  const right = Buffer.from(String(b || ''));

  return left.length === right.length &&
    crypto.timingSafeEqual(left, right);
}

export function verifyFamilySession(req, expectedFamilyId) {
  const secret = process.env.HOMEFIN_SESSION_SECRET;

  if (!secret || secret.length < 32 || !expectedFamilyId) {
    return { valid: false, error: 'Sessão não configurada.' };
  }

  const authorization = String(req.headers?.authorization || '');
  const match = authorization.match(/^Bearer\s+(.+)$/i);

  if (!match) {
    return { valid: false, error: 'Sessão ausente.' };
  }

  const parts = match[1].split('.');

  if (parts.length !== 2) {
    return { valid: false, error: 'Sessão inválida.' };
  }

  const [encodedPayload, suppliedSignature] = parts;

  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(encodedPayload)
    .digest('base64url');

  if (!safeEqual(suppliedSignature, expectedSignature)) {
    return { valid: false, error: 'Assinatura inválida.' };
  }

  let payload;

  try {
    payload = JSON.parse(
      Buffer.from(encodedPayload, 'base64url').toString('utf8')
    );
  } catch {
    return { valid: false, error: 'Sessão inválida.' };
  }

  if (
    payload.familyId !== expectedFamilyId ||
    !Number.isInteger(payload.iat) ||
    !Number.isFinite(payload.exp) ||
    payload.iat > Math.floor(Date.now() / 1000) + 60 ||
    payload.exp <= payload.iat ||
    payload.exp - payload.iat > 43200 ||
    payload.exp <= Math.floor(Date.now() / 1000) ||
    (payload.sessionVersion !== undefined &&
      (!Number.isInteger(payload.sessionVersion) || payload.sessionVersion < 1))
  ) {
    return { valid: false, error: 'Sessão expirada ou incompatível.' };
  }

  return {
    valid: true,
    familyId: payload.familyId,
    sessionVersion: payload.sessionVersion ?? 1,
  };
}

export async function validateFamilySession(req, expectedFamilyId) {
  const session = verifyFamilySession(req, expectedFamilyId);
  if (!session.valid) return session;

  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Configuração segura do Supabase indisponível.');
  }

  const query = new URLSearchParams({
    family_id: `eq.${session.familyId}`,
    select: 'session_version',
    limit: '1',
  });
  let response;
  try {
    response = await fetch(
      `${supabaseUrl.replace(/\/+$/, '')}/rest/v1/homefin_family_credentials?${query}`,
      {
        headers: {
          apikey: serviceRoleKey,
          Authorization: `Bearer ${serviceRoleKey}`,
          Accept: 'application/json',
        },
        cache: 'no-store',
      }
    );
  } catch (error) {
    throw new Error('Não foi possível validar a sessão familiar no servidor.', { cause: error });
  }
  if (!response.ok) {
    throw new Error('Não foi possível validar a sessão familiar no servidor.');
  }

  const credentials = await response.json();
  const currentVersion = credentials?.[0]?.session_version;
  if (
    !Number.isInteger(currentVersion) ||
    currentVersion !== session.sessionVersion
  ) {
    return { valid: false, error: 'Sessão revogada ou incompatível.' };
  }

  return session;
}

export function createFamilySessionToken(familyId, sessionVersion = 1) {
  const secret = process.env.HOMEFIN_SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error('HOMEFIN_SESSION_SECRET deve ter pelo menos 32 caracteres.');
  }

  const payload = Buffer.from(JSON.stringify({
    familyId,
    sessionVersion,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 43200,
  })).toString('base64url');
  const signature = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('base64url');

  return `${payload}.${signature}`;
}
