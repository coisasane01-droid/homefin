import crypto from 'node:crypto';
import { promisify } from 'node:util';
const scrypt = promisify(crypto.scrypt);
import {
  generateRegistrationOptions, verifyRegistrationResponse,
  generateAuthenticationOptions, verifyAuthenticationResponse,
} from '@simplewebauthn/server';
import { validateFamilySession, createFamilySessionToken } from './_family-session.js';

const FAMILY_PATTERN = /^[a-z0-9][a-z0-9-]{0,99}$/;
const ORIGIN = process.env.HOMEFIN_WEBAUTHN_ORIGIN || 'https://homefinapp.vercel.app';
const RP_ID = new URL(ORIGIN).hostname;
const b64 = value => Buffer.from(value).toString('base64url');
const sha = value => crypto.createHash('sha256').update(value).digest('hex');

async function db(path, options = {}) {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Supabase indisponível.');
  const response = await fetch(`${url.replace(/\/+$/, '')}/rest/v1/${path}`, {
    ...options,
    headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', ...(options.headers || {}) },
    cache: 'no-store',
  });
  if (!response.ok) throw new Error(`Falha na operação segura (${response.status}).`);
  const content = await response.text();
  return content ? JSON.parse(content) : null;
}

function clientChallenge(response) {
  if (typeof response?.response?.clientDataJSON !== 'string') throw new Error('Resposta inválida.');
  const raw = Buffer.from(response.response.clientDataJSON, 'base64url');
  if (raw.length > 4096) throw new Error('Resposta inválida.');
  const client = JSON.parse(raw.toString('utf8'));
  if (typeof client.challenge !== 'string' || client.challenge.length > 256) throw new Error('Desafio inválido.');
  return client.challenge;
}

async function issueChallenge(familyId, purpose, challenge) {
  await db('homefin_family_passkey_challenges', {
    method: 'POST', body: JSON.stringify({ family_id: familyId, purpose, challenge_hash: sha(challenge), expires_at: new Date(Date.now() + 120000).toISOString() }),
  });
}

async function consumeChallenge(familyId, purpose, challenge) {
  const consumed = await db('rpc/homefin_consume_passkey_challenge', {
    method: 'POST', body: JSON.stringify({ p_family_id: familyId, p_purpose: purpose, p_challenge_hash: sha(challenge) }),
  });
  return consumed === true;
}

async function rateLimit(familyId, purpose) {
  const allowed = await db('rpc/homefin_passkey_allow_request', {
    method: 'POST', body: JSON.stringify({ p_family_id: familyId, p_purpose: purpose }),
  });
  if (allowed !== true) throw Object.assign(new Error('Muitas solicitações de biometria. Aguarde 10 minutos.'), { status: 429 });
}

async function verifyRegistrationPin(req, familyId, pin) {
  if (typeof pin !== 'string' || !/^\d{4}$/.test(pin)) {
    throw Object.assign(new Error('Informe o PIN atual de 4 dígitos.'), { status: 401 });
  }
  const secret = process.env.HOMEFIN_SESSION_SECRET;
  if (!secret || secret.length < 32) throw new Error('Segurança indisponível.');
  const ip = String(req.headers['x-vercel-forwarded-for'] || req.headers['x-real-ip'] || String(req.headers['x-forwarded-for'] || '').split(',')[0] || req.socket?.remoteAddress || 'unknown');
  const ipHash = crypto.createHmac('sha256', secret).update(ip).digest('hex');
  const since = new Date(Date.now() - 3600000).toISOString();
  const fq = new URLSearchParams({family_id:`eq.${familyId}`,attempted_at:`gte.${since}`,select:'id',limit:'5'});
  const iq = new URLSearchParams({ip_hash:`eq.${ipHash}`,attempted_at:`gte.${since}`,select:'id',limit:'20'});
  const [fa,ia] = await Promise.all([db(`homefin_auth_attempts?${fq}`),db(`homefin_auth_attempts?${iq}`)]);
  if (fa.length >= 5 || ia.length >= 20) throw Object.assign(new Error('Muitas tentativas de PIN. Aguarde uma hora.'), {status:429});
  const cq = new URLSearchParams({family_id:`eq.${familyId}`,select:'pin_salt,pin_hash',limit:'1'});
  const rows = await db(`homefin_family_credentials?${cq}`);
  const expected = rows[0]?.pin_hash;
  const actual = rows[0]?.pin_salt ? (await scrypt(pin, rows[0].pin_salt, 64)).toString('hex') : '';
  const x=Buffer.from(actual), y=Buffer.from(String(expected||''));
  if (!expected || x.length !== y.length || !crypto.timingSafeEqual(x,y)) {
    await db('rpc/homefin_register_auth_failure',{method:'POST',body:JSON.stringify({p_family_id:familyId,p_ip_hash:ipHash})});
    throw Object.assign(new Error('PIN atual incorreto.'), {status:401});
  }
}

async function currentSession(req, familyId) {
  const session = await validateFamilySession(req, familyId);
  if (!session.valid) throw Object.assign(new Error(session.error || 'Sessão inválida.'), { status: 401 });
  return session;
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido.' });
  if (JSON.stringify(req.body || {}).length > 30000) return res.status(413).json({ error: 'Requisição muito grande.' });
  const { familyId, action, response, pin } = req.body || {};
  if (typeof familyId !== 'string' || !FAMILY_PATTERN.test(familyId)) return res.status(400).json({ error: 'Família inválida.' });
  if (req.headers.origin && req.headers.origin !== ORIGIN) return res.status(403).json({ error: 'Origem não autorizada.' });
  try {
    if (action === 'register-options') {
      await currentSession(req, familyId);
      await rateLimit(familyId, 'register');
      await verifyRegistrationPin(req, familyId, pin);
      const options = await generateRegistrationOptions({
        rpName: 'HomeFin', rpID: RP_ID,
        userID: new TextEncoder().encode(familyId), userName: familyId,
        attestationType: 'none',
        authenticatorSelection: { residentKey: 'preferred', userVerification: 'required' },
      });
      await issueChallenge(familyId, 'register', options.challenge);
      return res.status(200).json({ options });
    }
    if (action === 'register-verify') {
      await currentSession(req, familyId);
      if (!response || !await consumeChallenge(familyId, 'register', clientChallenge(response))) {
        return res.status(401).json({ error: 'Desafio expirado ou já utilizado.' });
      }
      const verified = await verifyRegistrationResponse({
        response, expectedChallenge: clientChallenge(response), expectedOrigin: ORIGIN,
        expectedRPID: RP_ID, requireUserVerification: true,
      });
      if (!verified.verified || !verified.registrationInfo) return res.status(401).json({ error: 'Biometria não validada.' });
      const credential = verified.registrationInfo.credential;
      await db('homefin_family_passkeys', {
        method: 'POST', body: JSON.stringify({
          family_id: familyId, credential_id: credential.id,
          public_key: b64(credential.publicKey), counter: credential.counter,
          transports: credential.transports || [], device_name: 'Aparelho autorizado',
        }),
      });
      return res.status(200).json({ success: true });
    }
    if (action === 'authenticate-options') {
      await rateLimit(familyId, 'authenticate');
      const query = new URLSearchParams({ family_id: `eq.${familyId}`, select: 'credential_id', limit: '50' });
      const keys = await db(`homefin_family_passkeys?${query}`);
      if (!keys.length) return res.status(404).json({ error: 'Nenhuma biometria cadastrada nesta família.' });
      const options = await generateAuthenticationOptions({
        rpID: RP_ID, userVerification: 'required',
        allowCredentials: keys.map(key => ({ id: key.credential_id })),
      });
      await issueChallenge(familyId, 'authenticate', options.challenge);
      return res.status(200).json({ options });
    }
    if (action === 'authenticate-verify') {
      if (typeof response?.id !== 'string' || response.id.length > 1024) return res.status(400).json({ error: 'Credencial inválida.' });
      if (!await consumeChallenge(familyId, 'authenticate', clientChallenge(response))) {
        return res.status(401).json({ error: 'Desafio expirado ou já utilizado.' });
      }
      const query = new URLSearchParams({ family_id: `eq.${familyId}`, credential_id: `eq.${response.id}`, select: 'id,credential_id,public_key,counter,transports', limit: '1' });
      const keys = await db(`homefin_family_passkeys?${query}`);
      if (keys.length !== 1) return res.status(401).json({ error: 'Credencial não autorizada.' });
      const key = keys[0];
      const verified = await verifyAuthenticationResponse({
        response, expectedChallenge: clientChallenge(response), expectedOrigin: ORIGIN,
        expectedRPID: RP_ID, requireUserVerification: true,
        credential: { id: key.credential_id, publicKey: Buffer.from(key.public_key, 'base64url'), counter: Number(key.counter), transports: key.transports },
      });
      if (!verified.verified) return res.status(401).json({ error: 'Biometria não validada.' });
      const updated = await db(`homefin_family_passkeys?id=eq.${key.id}&counter=eq.${key.counter}`, {
        method: 'PATCH', headers: { Prefer: 'return=representation' },
        body: JSON.stringify({ counter: verified.authenticationInfo.newCounter, last_used_at: new Date().toISOString() }),
      });
      if (!Array.isArray(updated) || updated.length !== 1) return res.status(409).json({ error: 'Credencial alterada. Tente novamente.' });
      const family = await db(`homefin_family_credentials?${new URLSearchParams({ family_id: `eq.${familyId}`, select: 'session_version', limit: '1' })}`);
      if (!Number.isInteger(family[0]?.session_version)) return res.status(401).json({ error: 'Família não autorizada.' });
      return res.status(200).json({ success: true, token: createFamilySessionToken(familyId, family[0].session_version), expiresIn: 43200 });
    }
    return res.status(400).json({ error: 'Ação inválida.' });
  } catch (error) {
    console.error('WebAuthn:', error instanceof Error ? error.message : 'Erro desconhecido');
    return res.status(error?.status || 400).json({ error: [401,429].includes(error?.status) ? error.message : 'Não foi possível concluir a autenticação biométrica.' });
  }
}
