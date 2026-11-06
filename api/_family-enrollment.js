import crypto from 'node:crypto';
import { getAdminSessionReference } from './admin-auth.js';

const FAMILY_ID_PATTERN = /^[a-z0-9][a-z0-9-]{0,99}$/;
const VERIFICATION_METHODS = new Set([
  'known_phone',
  'previously_verified_email',
  'in_person',
  'other_official_channel',
]);

class SupabaseRpcError extends Error {
  constructor(status, code, message) {
    super(message || `Supabase RPC returned HTTP ${status}.`);
    this.name = 'SupabaseRpcError';
    this.status = status;
    this.code = code;
  }
}

function getSupabaseConfig() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Configuração server-side do Supabase ausente.');
  return { url: url.replace(/\/+$/, ''), key };
}

async function callRpc(name, payload) {
  const { url, key } = getSupabaseConfig();
  const response = await fetch(`${url}/rest/v1/rpc/${name}`, {
    method: 'POST',
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
    cache: 'no-store',
  });
  const text = await response.text();
  if (!response.ok) {
    let responseError = {};
    try {
      responseError = text ? JSON.parse(text) : {};
    } catch {
      responseError = {};
    }
    throw new SupabaseRpcError(
      response.status,
      typeof responseError.code === 'string' ? responseError.code : '',
      typeof responseError.message === 'string' ? responseError.message : ''
    );
  }
  return text ? JSON.parse(text) : null;
}

function getIssuanceFailure(error) {
  if (error instanceof SupabaseRpcError) {
    if (
      error.status === 404 ||
      ['PGRST202', 'PGRST203', '42883'].includes(error.code)
    ) {
      return {
        status: 503,
        error: 'A função de autorização não foi encontrada pelo Supabase ou sua assinatura está desatualizada. Verifique a migração de provisionamento e a atualização do cache da API.',
        stage: 'rpc-not-found-or-signature-mismatch',
      };
    }
    if (
      error.status === 401 ||
      error.status === 403 ||
      error.code === '42501'
    ) {
      return {
        status: 503,
        error: 'O servidor não tem permissão para registrar autorizações. Verifique a configuração server-side e a permissão da função para service_role.',
        stage: 'rpc-permission-denied',
      };
    }
    if (error.status === 400) {
      return {
        status: 422,
        error: 'O banco rejeitou os dados de autorização. Verifique a compatibilidade da migração e os valores enviados.',
        stage: 'rpc-request-rejected',
      };
    }
    return {
      status: 503,
      error: 'O banco não conseguiu registrar a autorização. Tente novamente e, se persistir, consulte os logs do servidor.',
      stage: 'rpc-database-failure',
    };
  }

  if (error instanceof Error && error.message === 'Configuração server-side do Supabase ausente.') {
    return {
      status: 503,
      error: 'A conexão server-side com o Supabase não está configurada.',
      stage: 'supabase-server-configuration',
    };
  }

  return {
    status: 503,
    error: 'Não foi possível conectar ao serviço de autorização. Tente novamente e, se persistir, consulte os logs do servidor.',
    stage: 'rpc-transport-or-unexpected-failure',
  };
}

function getIpHash(req) {
  const secret = process.env.HOMEFIN_SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error('HOMEFIN_SESSION_SECRET deve ter pelo menos 32 caracteres.');
  }
  const forwardedIp = req.headers?.['x-vercel-forwarded-for'] ||
    req.headers?.['x-real-ip'] ||
    String(req.headers?.['x-forwarded-for'] || '').split(',')[0]?.trim();
  const address = String(forwardedIp || req.socket?.remoteAddress || 'unknown');
  return crypto.createHmac('sha256', secret).update(address).digest('hex');
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Método não permitido.' });
  }
  const adminSessionReference = getAdminSessionReference(req);
  if (!adminSessionReference) {
    return res.status(401).json({ error: 'Sessão administrativa inválida.' });
  }

  const {
    action,
    familyId,
    ownershipVerified,
    verificationMethod,
    purpose,
  } = req.body || {};
  const targetFamilyId = String(familyId || '').trim();

  if (action !== 'issue-enrollment') {
    return res.status(400).json({ error: 'Ação inválida.' });
  }
  if (!FAMILY_ID_PATTERN.test(targetFamilyId)) {
    return res.status(400).json({ error: 'Identificador familiar inválido.' });
  }
  if (ownershipVerified !== true) {
    return res.status(400).json({ error: 'Confirme a verificação independente da titularidade antes de continuar.' });
  }
  if (!VERIFICATION_METHODS.has(verificationMethod)) {
    return res.status(400).json({ error: 'Selecione um método válido de confirmação independente.' });
  }
  if (purpose !== 'provision' && purpose !== 'pin_recovery') {
    return res.status(400).json({ error: 'Selecione o tipo de regularização.' });
  }

  try {
    const authorizationCode = crypto.randomBytes(32).toString('base64url');
    const authorizationHash = crypto.createHash('sha256')
      .update(authorizationCode)
      .digest('hex');
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
    const result = await callRpc('homefin_issue_family_enrollment_authorization', {
      p_family_id: targetFamilyId,
      p_authorization_hash: authorizationHash,
      p_expires_at: expiresAt,
      p_verified_by: `admin-session:${adminSessionReference}`,
      p_ownership_verified: ownershipVerified,
      p_verification_method: verificationMethod,
      p_purpose: purpose,
      p_ip_hash: getIpHash(req),
    });

    if (result?.success !== true) {
      const failures = {
        family_not_found: [404, 'Família não encontrada no servidor.'],
        credential_exists: [409, 'Esta família já possui credencial; nenhuma foi substituída.'],
        credential_missing: [409, 'A família não possui credencial para recuperar o PIN.'],
        invalid_request: [400, 'Os dados de autorização foram rejeitados.'],
      };
      const [status, error] = failures[result?.reason] || [
        503,
        'Não foi possível registrar a autorização no servidor.',
      ];
      return res.status(status).json({ error });
    }

    return res.status(201).json({
      success: true,
      familyId: targetFamilyId,
      authorizationCode,
      expiresAt,
      oneTime: true,
      purpose,
    });
  } catch (error) {
    const failure = getIssuanceFailure(error);
    console.error('Falha ao emitir autorização familiar:', {
      stage: failure.stage,
      rpc: 'homefin_issue_family_enrollment_authorization',
      httpStatus: error instanceof SupabaseRpcError ? error.status : undefined,
      databaseCode: error instanceof SupabaseRpcError ? error.code || undefined : undefined,
      databaseMessage: error instanceof SupabaseRpcError
        ? error.message.slice(0, 300)
        : error instanceof Error
          ? error.message.slice(0, 300)
          : 'erro desconhecido',
    });
    return res.status(failure.status).json({ error: failure.error });
  }
}
