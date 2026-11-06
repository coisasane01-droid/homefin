import crypto from 'crypto';

function safeEqual(a, b) {
  const left = Buffer.from(String(a || ''));
  const right = Buffer.from(String(b || ''));

  return left.length === right.length &&
    crypto.timingSafeEqual(left, right);
}

export function verifyFamilySession(req, expectedFamilyId) {
  const secret = process.env.HOMEFIN_SESSION_SECRET;

  if (!secret || !expectedFamilyId) {
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
    !Number.isFinite(payload.exp) ||
    payload.exp <= Math.floor(Date.now() / 1000)
  ) {
    return { valid: false, error: 'Sessão expirada ou incompatível.' };
  }

  return { valid: true, familyId: payload.familyId };
}
