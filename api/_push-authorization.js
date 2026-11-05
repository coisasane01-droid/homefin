import { validateFamilySession } from './_family-session.js';
import { verifyAdminSession } from './admin-auth.js';

const FAMILY_ID_PATTERN = /^[a-z0-9][a-z0-9-]{0,99}$/;

export async function authorizePushIdentity(req, familyId, userType) {
  if (userType === 'family') {
    if (typeof familyId !== 'string' || !FAMILY_ID_PATTERN.test(familyId)) {
      return { valid: false, status: 400, error: 'Identificador familiar inválido.' };
    }

    let session;
    try {
      session = await validateFamilySession(req, familyId);
    } catch (error) {
      console.error(
        'Falha ao validar sessão para Push:',
        error instanceof Error ? error.message : 'erro desconhecido'
      );
      return { valid: false, status: 503, error: 'Não foi possível validar a sessão familiar.' };
    }
    if (!session.valid) {
      return {
        valid: false,
        status: 401,
        error: session.error || 'Sessão familiar inválida.',
      };
    }

    return { valid: true, familyId: session.familyId, userType };
  }

  if (userType === 'admin' && familyId === 'admin') {
    if (!verifyAdminSession(req)) {
      return { valid: false, status: 401, error: 'Sessão administrativa inválida.' };
    }
    return { valid: true, familyId: 'admin', userType };
  }

  return { valid: false, status: 400, error: 'Perfil de notificação inválido.' };
}
